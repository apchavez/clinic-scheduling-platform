const create = jest.fn();
const listByInsured = jest.fn();
const complete = jest.fn();
jest.mock("../src/index", () => ({
  __esModule: true,
  appointmentMakeService: () => ({
    create,
    listByInsured,
    complete,
  }),
}));

import * as handler from "../src/api/lambda/appointment";

const json = (r: any) => JSON.parse(r?.body ?? "{}");

beforeEach(() => {
  jest.clearAllMocks();
  create.mockReset();
  listByInsured.mockReset();
  complete.mockReset();
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── createAppointment ───────────────────────────────────────────────────────

test("POST /appointments -> 400 if no body", async () => {
  const res = await handler.createAppointment({ body: null } as any);
  expect(res.statusCode).toBe(400);
  expect(json(res).message).toBe("Required body");
});

test("POST /appointments -> 400 if malformed JSON body", async () => {
  const res = await handler.createAppointment({ body: "not-json" } as any);
  expect(res.statusCode).toBe(400);
  expect(json(res).message).toBe("Invalid body (JSON)");
});

test("POST /appointments -> 400 if required fields are missing", async () => {
  const res = await handler.createAppointment({ body: "{}" } as any);
  expect(res.statusCode).toBe(400);
  expect(json(res).message).toBe(
    "insuredId, scheduleId and countryISO are required"
  );
});

test("POST /appointments -> 400 if countryISO is invalid", async () => {
  const res = await handler.createAppointment({
    body: JSON.stringify({ insuredId: "01234", scheduleId: 1, countryISO: "XX" }),
  } as any);
  expect(res.statusCode).toBe(400);
  expect(json(res).message).toBe("countryISO must be 'PE' or 'CL'");
});

test("POST /appointments -> 400 if scheduleId is non-numeric", async () => {
  const res = await handler.createAppointment({
    body: JSON.stringify({ insuredId: "01234", scheduleId: "abc", countryISO: "PE" }),
  } as any);
  expect(res.statusCode).toBe(400);
  expect(json(res).message).toBe("scheduleId must be numeric");
});

test("POST /appointments -> 201 (happy path)", async () => {
  create.mockResolvedValue({ appointmentUuid: "u1", status: "pending" });

  const res = await handler.createAppointment({
    body: JSON.stringify({ insuredId: "01234", scheduleId: 100, countryISO: "PE" }),
  } as any);

  expect(create).toHaveBeenCalledWith({
    insuredId: "01234",
    scheduleId: 100,
    countryISO: "PE",
  });
  expect(res.statusCode).toBe(201);
  expect(json(res).status).toBe("pending");
});

// ─── listByInsured ───────────────────────────────────────────────────────────

test("GET /appointments/{insuredId} -> 200", async () => {
  listByInsured.mockResolvedValue([{ appointmentUuid: "u1", status: "pending" }]);

  const res = await handler.listByInsured({
    pathParameters: { insuredId: "01234" },
  } as any);

  expect(listByInsured).toHaveBeenCalledWith("01234");
  expect(res.statusCode).toBe(200);
  expect(json(res)).toHaveLength(1);
});

test("GET /appointments/{insuredId} -> 400 if insuredId missing", async () => {
  const res = await handler.listByInsured({ pathParameters: null } as any);
  expect(res.statusCode).toBe(400);
  expect(json(res).message).toBe("insuredId required");
});

// ─── confirmAppointment ──────────────────────────────────────────────────────

test("SQS record -> calls service with appointmentUuid", async () => {
  complete.mockResolvedValue(undefined);

  await handler.confirmAppointment({
    Records: [{ body: JSON.stringify({ detail: { appointmentUuid: "u1" } }) }],
  } as any);

  expect(complete).toHaveBeenCalledWith("u1");
});

test("SQS record -> skips malformed JSON without calling complete", async () => {
  await handler.confirmAppointment({
    Records: [{ body: "not-valid-json", messageId: "msg-1" }],
  } as any);

  expect(complete).not.toHaveBeenCalled();
});

test("SQS record -> skips record missing appointmentUuid without calling complete", async () => {
  await handler.confirmAppointment({
    Records: [{ body: JSON.stringify({ detail: {} }), messageId: "msg-2" }],
  } as any);

  expect(complete).not.toHaveBeenCalled();
});
