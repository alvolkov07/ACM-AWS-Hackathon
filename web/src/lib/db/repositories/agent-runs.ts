import { ObjectId } from "mongodb";

import { getDb } from "@/lib/db/client";
import { parseDocument } from "@/lib/db/parse";
import {
  AGENT_RUNS_COLLECTION,
  agentRunCreateSchema,
  agentRunSchema,
  type AgentRun,
  type AgentRunCreate,
} from "@/lib/db/schemas/agent-run";

export type AgentRunListFilter = {
  requestId: string | ObjectId;
};

export async function createAgentRun(
  input: AgentRunCreate,
): Promise<AgentRun> {
  const data = agentRunCreateSchema.parse(input);
  const db = await getDb();
  const doc = {
    ...data,
    createdAt: new Date(),
  };
  const result = await db.collection(AGENT_RUNS_COLLECTION).insertOne(doc);
  return parseDocument(
    agentRunSchema,
    { ...doc, _id: result.insertedId },
    "AgentRun",
  );
}

export async function getAgentRunById(
  id: string | ObjectId,
): Promise<AgentRun | null> {
  const db = await getDb();
  const doc = await db.collection(AGENT_RUNS_COLLECTION).findOne({
    _id: typeof id === "string" ? new ObjectId(id) : id,
  });
  if (!doc) {
    return null;
  }
  return parseDocument(agentRunSchema, doc, "AgentRun");
}

export async function listAgentRuns(
  filter: AgentRunListFilter,
): Promise<AgentRun[]> {
  const db = await getDb();
  const query: Record<string, unknown> = {
    requestId:
      typeof filter.requestId === "string"
        ? new ObjectId(filter.requestId)
        : filter.requestId,
  };
  const docs = await db
    .collection(AGENT_RUNS_COLLECTION)
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();
  return docs.map((doc) => parseDocument(agentRunSchema, doc, "AgentRun"));
}
