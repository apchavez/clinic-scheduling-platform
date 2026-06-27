import type { SQSHandler } from "aws-lambda";
import type { Appointment } from "../../domain/entities/Appointment";
import { MySQLCountryBookingRepo } from "../../infra/repos/MySQLCountryBookingRepo";
import {
  sendConfirmation,
  type Source,
} from "../../infra/messaging/eventbridge.service";

const repo = new MySQLCountryBookingRepo();

function makeCountryHandler(source: Source): SQSHandler {
  return async (event) => {
    for (const record of event.Records) {
      try {
        const raw = JSON.parse(record.body) as Record<string, unknown>;
        const payload = (raw.Message
          ? JSON.parse(raw.Message as string)
          : raw) as Appointment;
        await repo.book(payload);
        await sendConfirmation(source, { appointmentUuid: payload.appointmentUuid });
      } catch (err) {
        console.error(`[${source}] failed to process record ${record.messageId}:`, err);
        throw err;
      }
    }
  };
}

export const handlerPE = makeCountryHandler("appointment.pe");
export const handlerCL = makeCountryHandler("appointment.cl");
