import { mockClient } from "aws-sdk-client-mock";
import { SNSClient, PublishCommand } from "@aws-sdk/client-sns";
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";

const snsMock = mockClient(SNSClient);
const ddbMock = mockClient(DynamoDBDocumentClient);

describe("Appointments Service (unit)", () => {
  let svc: any;

  beforeAll(async () => {
    process.env.TABLE_APPOINTMENTS = "Appointments";
    process.env.SNS_APPOINTMENTS_ARN =
      "arn:aws:sns:us-east-1:111111111111:appointments";
    const { appointmentMakeService } = await import("../src/index");
    svc = appointmentMakeService();
  });

  beforeEach(() => {
    snsMock.reset();
    ddbMock.reset();
  });

  test('create -> saves "pending" in Dynamo and publishes SNS with countryISO attribute', async () => {
    ddbMock.on(PutCommand).resolves({});
    snsMock.on(PublishCommand).resolves({});

    const out = await svc.create({
      insuredId: "01234",
      scheduleId: 100,
      countryISO: "PE",
    });

    expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    const putIn = ddbMock.commandCalls(PutCommand)[0].args[0].input as any;
    expect(putIn.TableName).toBe(process.env.TABLE_APPOINTMENTS);
    expect(putIn.Item.insuredId).toBe("01234");
    expect(putIn.Item.scheduleId).toBe(100);
    expect(putIn.Item.countryISO).toBe("PE");
    expect(putIn.Item.status).toBe("pending");
    expect(String(putIn.ConditionExpression)).toMatch(
      /attribute_not_exists\s*\(\s*appointmentUuid\s*\)/i
    );

    expect(snsMock.commandCalls(PublishCommand)).toHaveLength(1);
    const pubIn = snsMock.commandCalls(PublishCommand)[0].args[0].input as any;
    expect(pubIn.MessageAttributes?.countryISO?.StringValue).toBe("PE");

    expect(out.status).toBe("pending");
    expect(out.appointmentUuid).toBeTruthy();
  });

  test('complete -> marks status as "completed" in Dynamo', async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await svc.complete("u1");

    expect(ddbMock.commandCalls(UpdateCommand)).toHaveLength(1);
    const updIn = ddbMock.commandCalls(UpdateCommand)[0].args[0].input as any;
    expect(updIn.TableName).toBe(process.env.TABLE_APPOINTMENTS);
    expect(updIn.Key.appointmentUuid).toBe("u1");
    expect(String(updIn.UpdateExpression)).toMatch(/set\s+#status\s*=\s*:c/i);
    expect(updIn.ExpressionAttributeNames?.["#status"]).toBe("status");
    expect(updIn.ExpressionAttributeValues?.[":c"]).toBe("completed");
    expect(String(updIn.ConditionExpression)).toMatch(
      /attribute_exists\s*\(\s*appointmentUuid\s*\)/i
    );
  });

  test("listByInsured -> queries DynamoDB by insuredId using byInsured GSI and returns items", async () => {
    const mockItems = [
      {
        appointmentUuid: "u1",
        insuredId: "01234",
        scheduleId: 100,
        countryISO: "PE",
        status: "pending",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    ddbMock.on(QueryCommand).resolves({ Items: mockItems });

    const result = await svc.listByInsured("01234");

    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(1);
    const queryIn = ddbMock.commandCalls(QueryCommand)[0].args[0].input as any;
    expect(queryIn.TableName).toBe(process.env.TABLE_APPOINTMENTS);
    expect(queryIn.IndexName).toBe("byInsured");
    expect(String(queryIn.KeyConditionExpression)).toMatch(/insuredId\s*=\s*:a/);
    expect(queryIn.ExpressionAttributeValues?.[":a"]).toBe("01234");
    expect(result).toEqual(mockItems);
  });
});
