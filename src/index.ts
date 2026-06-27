import { DynamoAppointmentStateRepo } from "./infra/repos/DynamoAppointmentStateRepo";
import { SnsMessageBus } from "./infra/messaging/sns.service";
import { AppointmentService } from "./app/usecases/appointment.service";

export const appointmentMakeService = () => {
  const stateRepo = new DynamoAppointmentStateRepo();
  const messageBus = new SnsMessageBus();
  return new AppointmentService(stateRepo, messageBus);
};
