import type { TableNames } from "../../_generated/dataModel";
import { GROUP_DELETION_PURGE_TABLES } from "./groupDeletionRegistry";

export type PurgeStage = (typeof GROUP_DELETION_PURGE_TABLES)[number] & TableNames;
export type StageProgress = { deleted: number; storageFiles: number };
