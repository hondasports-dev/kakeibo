export type AppEnvironment = "development" | "preview" | "production";

export type UserSearchItem = {
  id: string;
  userId: string;
  displayName: string;
  email: string | null;
  activeGroupId: string | null;
  createdAt: number;
  updatedAt: number;
};

export type GroupSearchItem = {
  id: string;
  name: string;
  status: "active" | "deleting" | "deleted" | "archived";
  createdAt: number;
  updatedAt: number;
};

export type PageResult<T> = {
  environment: AppEnvironment;
  page: T[];
  isDone: boolean;
  continueCursor: string;
};
