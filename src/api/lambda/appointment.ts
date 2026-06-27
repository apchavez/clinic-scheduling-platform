import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SQSEvent,
} from "aws-lambda";
import { appointmentMakeService } from "../../index";
import { ok, created, bad } from "../../shared/http";
import type { CountryISO } from "../../domain/types";

const svc = appointmentMakeService();

export const createAppointment = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  if (!event.body) return bad("Required body");

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(event.body) as Record<string, unknown>;
  } catch {
    return bad("Invalid body (JSON)");
  }

  const { insuredId, scheduleId, countryISO } = payload;

  if (!insuredId || scheduleId == null || !countryISO) {
    return bad("insuredId, scheduleId and countryISO are required");
  }
  if (!["PE", "CL"].includes(String(countryISO))) {
    return bad("countryISO must be 'PE' or 'CL'");
  }
  if (Number.isNaN(Number(scheduleId))) {
    return bad("scheduleId must be numeric");
  }

  const appointment = await svc.create({
    insuredId: String(insuredId),
    scheduleId: Number(scheduleId),
    countryISO: countryISO as CountryISO,
  });
  return created(appointment);
};

export const listByInsured = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const insuredId = event.pathParameters?.insuredId;
  if (!insuredId) return bad("insuredId required");
  return ok(await svc.listByInsured(String(insuredId)));
};

export const confirmAppointment = async (event: SQSEvent): Promise<void> => {
  for (const r of event.Records) {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(r.body) as Record<string, unknown>;
    } catch {
      console.warn("confirmAppointment: skipping malformed record", r.messageId);
      continue;
    }
    const detail = (body.detail ?? body) as Record<string, unknown>;
    const { appointmentUuid } = detail;
    if (!appointmentUuid) {
      console.warn("confirmAppointment: record missing appointmentUuid", r.messageId);
      continue;
    }
    await svc.complete(String(appointmentUuid));
  }
};
