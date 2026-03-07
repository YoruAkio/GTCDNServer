create table if not exists "folder" (
  "path" text not null primary key,
  "createdAt" date not null,
  "updatedAt" date not null
);
