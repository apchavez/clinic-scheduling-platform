# Clinic Scheduling Platform

Backend platform for medical appointment scheduling built with **TypeScript**, **AWS Serverless**, and **Clean Architecture**.

This project simulates a production-grade healthcare booking workflow using asynchronous event-driven processing, multiple data stores, and scalable cloud services.

> Designed as a portfolio project to demonstrate backend engineering skills in distributed systems, serverless architecture, and maintainable code structure.

---

## Tech Stack

- TypeScript
- Node.js
- AWS Lambda
- API Gateway (HTTP API)
- DynamoDB
- MySQL (RDS)
- SNS
- SQS
- EventBridge
- Serverless Framework v3
- Jest
- OpenAPI / Swagger

---

## Architecture

The application follows **Clean Architecture** principles:

- **Domain layer** — Entities (`Appointment`) and port contracts (`IAppointmentStateRepo`, `IMessageBus`, `ICountryBookingRepo`)
- **Application layer** — Use cases (`AppointmentService`)
- **Infrastructure layer** — Adapters for DynamoDB, MySQL, SNS, and EventBridge
- **API layer** — AWS Lambda handlers

---

## Project Structure

```text
src/
├── api/lambda/
│   ├── appointment.ts          HTTP handlers (create, list) + SQS confirm handler
│   └── appointment_country.ts  Unified country worker (PE + CL via factory)
├── app/usecases/
│   └── appointment.service.ts  Core use cases
├── docs/
│   └── openapi.yaml            OpenAPI contract
├── domain/
│   ├── entities/
│   │   └── Appointment.ts
│   ├── ports/
│   │   ├── IAppointmentStateRepo.ts
│   │   ├── ICountryBookingRepo.ts
│   │   └── IMessageBus.ts
│   └── types.ts
├── infra/
│   ├── config/ddb.ts           DynamoDB client
│   ├── messaging/
│   │   ├── eventbridge.service.ts
│   │   └── sns.service.ts      SnsMessageBus (implements IMessageBus)
│   ├── repos/
│   │   ├── DynamoAppointmentStateRepo.ts
│   │   └── MySQLCountryBookingRepo.ts
│   ├── db-init.ts              CloudFormation custom resource — creates MySQL tables
│   └── secrets-init.ts         CloudFormation custom resource — seeds SSM password
└── shared/
    └── http.ts                 HTTP response helpers
tests/
├── appointment.handler.unit.test.ts
└── appointment.service.unit.test.ts
```

---

## Main Workflow

```text
Client
  ↓
API Gateway (HTTP API)
  ↓
createAppointment Lambda
  ↓  saves status=pending
DynamoDB
  ↓  publishes with countryISO MessageAttribute
SNS Topic
  ↓  filtered by countryISO → PE or CL queue
SQS (appointments-pe / appointments-cl)
  ↓  country worker Lambda
MySQL RDS (country-specific DB)
  ↓  publishes AppointmentConfirmed
EventBridge
  ↓
SQS (appointments-confirmaciones)
  ↓
confirmAppointment Lambda
  ↓  updates status=completed
DynamoDB
```

Failed messages after 3 retries are routed to a Dead Letter Queue (14-day retention) for each SQS queue.

---

## API

### Create appointment

```http
POST /appointments
Content-Type: application/json

{
  "insuredId": "12345",
  "scheduleId": 10,
  "countryISO": "PE"
}
```

**Response 201**

```json
{
  "appointmentUuid": "b3d2f1a0-...",
  "insuredId": "12345",
  "scheduleId": 10,
  "countryISO": "PE",
  "status": "pending",
  "createdAt": "2026-06-01T12:00:00.000Z",
  "updatedAt": "2026-06-01T12:00:00.000Z"
}
```

**Validation errors (400)**

| Condition | Message |
|---|---|
| Missing body | `Required body` |
| Malformed JSON | `Invalid body (JSON)` |
| Missing fields | `insuredId, scheduleId and countryISO are required` |
| Invalid country | `countryISO must be 'PE' or 'CL'` |
| Non-numeric scheduleId | `scheduleId must be numeric` |

---

### List appointments by insured

```http
GET /appointments/{insuredId}
```

**Response 200**

```json
[
  {
    "appointmentUuid": "b3d2f1a0-...",
    "insuredId": "12345",
    "scheduleId": 10,
    "countryISO": "PE",
    "status": "completed",
    "createdAt": "2026-06-01T12:00:00.000Z",
    "updatedAt": "2026-06-01T12:00:00.000Z"
  }
]
```

---

## OpenAPI

Full contract at `src/docs/openapi.yaml`. Generate a static HTML doc with:

```bash
npm run docs
```

---

## Local Development

### Install dependencies

```bash
npm install
```

### Run tests

```bash
npm test
```

### Build

```bash
npm run build
```

### Run locally (serverless-offline)

```bash
npm run offline
```

---

## Deploy

### Configure VPC values

```bash
# Edit serverless.yml → custom.rds.vpcId / subnet1 / subnet2
```

### Deploy stack

```bash
npx serverless deploy
```

### Remove stack

```bash
npx serverless remove
```

---

## Logs

```bash
npx serverless logs -f createAppointment -t
npx serverless logs -f appointmentPE -t
npx serverless logs -f appointmentCL -t
npx serverless logs -f confirmAppointment -t
```

---

## Testing

Unit tests cover:

- Lambda handler validation and routing (`appointment.handler.unit.test.ts`)
- Service layer: DynamoDB writes and SNS publish (`appointment.service.unit.test.ts`)

```bash
npm test
```

---

## What This Project Demonstrates

- Clean Architecture with dependency inversion (ports & adapters)
- Event-driven systems with SNS fan-out → SQS per country
- Multi-database design: DynamoDB for state tracking, MySQL for relational persistence
- Parameterized Lambda handlers to eliminate code duplication
- Dead Letter Queues for reliability
- Typed Lambda events (`APIGatewayProxyEvent`, `SQSEvent`)
- AWS Serverless Framework with CloudFormation custom resources

---

## Future Improvements

- Authentication / RBAC
- CI/CD pipeline (GitHub Actions)
- Place worker Lambdas inside the VPC — enables `PubliclyAccessible: false` on RDS and security group restriction to Lambda SG only
- Integration tests against real AWS resources
- CloudWatch alarms on DLQ depth
- Notifications (Email / SMS) on appointment confirmation

---

## Author

**AP Chavez**  
Backend Engineer focused on Node.js, TypeScript, AWS, and scalable systems.
