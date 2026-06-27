const mockBook = jest.fn();
const mockSendConfirmation = jest.fn();

jest.mock("../src/infra/repos/MySQLCountryBookingRepo", () => ({
  MySQLCountryBookingRepo: jest.fn(() => ({ book: mockBook })),
}));

jest.mock("../src/infra/messaging/eventbridge.service", () => ({
  sendConfirmation: mockSendConfirmation,
}));

import type { SQSEvent, Context } from "aws-lambda";
import { handlerPE, handlerCL } from "../src/api/lambda/appointment_country";

const ctx = {} as Context;
const cb = jest.fn();

const appointment = {
  appointmentUuid: "u1",
  insuredId: "01234",
  scheduleId: 100,
  countryISO: "PE" as const,
  status: "pending" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function sqsEvent(body: object): SQSEvent {
  return {
    Records: [
      {
        messageId: "msg-1",
        receiptHandle: "receipt-1",
        body: JSON.stringify(body),
        attributes: {
          ApproximateReceiveCount: "1",
          SentTimestamp: "1626387030000",
          SenderId: "AROAI3KMYGUXI3D5ABCDE:lambda",
          ApproximateFirstReceiveTimestamp: "1626387030001",
        },
        messageAttributes: {},
        md5OfBody: "md5",
        eventSource: "aws:sqs",
        eventSourceARN: "arn:aws:sqs:us-east-1:111111111111:test",
        awsRegion: "us-east-1",
      },
    ],
  };
}

describe("appointment_country handler", () => {
  beforeEach(() => {
    mockBook.mockReset();
    mockSendConfirmation.mockReset();
    cb.mockReset();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("handlerPE -> calls repo.book with payload and sendConfirmation with source appointment.pe", async () => {
    mockBook.mockResolvedValue(undefined);
    mockSendConfirmation.mockResolvedValue(undefined);

    await handlerPE(sqsEvent(appointment), ctx, cb);

    expect(mockBook).toHaveBeenCalledTimes(1);
    expect(mockBook).toHaveBeenCalledWith(appointment);
    expect(mockSendConfirmation).toHaveBeenCalledTimes(1);
    expect(mockSendConfirmation).toHaveBeenCalledWith("appointment.pe", {
      appointmentUuid: "u1",
    });
  });

  test("handlerCL -> calls sendConfirmation with source appointment.cl", async () => {
    mockBook.mockResolvedValue(undefined);
    mockSendConfirmation.mockResolvedValue(undefined);

    await handlerCL(sqsEvent(appointment), ctx, cb);

    expect(mockBook).toHaveBeenCalledTimes(1);
    expect(mockBook).toHaveBeenCalledWith(appointment);
    expect(mockSendConfirmation).toHaveBeenCalledWith("appointment.cl", {
      appointmentUuid: "u1",
    });
  });

  test("handler -> unwraps SNS envelope when Message field is present", async () => {
    mockBook.mockResolvedValue(undefined);
    mockSendConfirmation.mockResolvedValue(undefined);

    await handlerPE(sqsEvent({ Message: JSON.stringify(appointment) }), ctx, cb);

    expect(mockBook).toHaveBeenCalledWith(appointment);
    expect(mockSendConfirmation).toHaveBeenCalledWith("appointment.pe", {
      appointmentUuid: "u1",
    });
  });

  test("handler -> re-throws on repo.book failure and does not call sendConfirmation", async () => {
    mockBook.mockRejectedValue(new Error("MySQL connection failed"));

    await expect(handlerPE(sqsEvent(appointment), ctx, cb)).rejects.toThrow(
      "MySQL connection failed"
    );

    expect(mockSendConfirmation).not.toHaveBeenCalled();
  });
});
