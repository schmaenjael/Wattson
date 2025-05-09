CREATE TABLE "tblBans" (
	"id" serial PRIMARY KEY NOT NULL,
	"fkUserTargetId" serial NOT NULL,
	"fkModeratorId" serial NOT NULL,
	"fkGuildId" serial NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"expiresAt" timestamp with time zone,
	"comment" varchar(512),
	"appealable" boolean NOT NULL,
	"successfullyAppealed" boolean
);
--> statement-breakpoint
CREATE TABLE "tblGuild" (
	"id" serial PRIMARY KEY NOT NULL,
	"guildId" char(20) NOT NULL,
	"prefix" char(1) NOT NULL,
	"reportLogChannel" char(20),
	"warningLogChannel" char(20),
	"automodLogChannel" char(20),
	"banLogChannel" char(20),
	"config" jsonb NOT NULL,
	"joinedAt" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tblGuild_guildId_unique" UNIQUE("guildId")
);
--> statement-breakpoint
CREATE TABLE "tblReports" (
	"id" serial PRIMARY KEY NOT NULL,
	"fkUserReportedId" serial NOT NULL,
	"fkUserReporterId" serial NOT NULL,
	"fkGuildId" serial NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"comment" varchar(512)
);
--> statement-breakpoint
CREATE TABLE "tblRoles" (
	"id" serial PRIMARY KEY NOT NULL,
	"discordId" char(20) NOT NULL,
	"fkGuildId" serial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tblStatistics" (
	"id" serial PRIMARY KEY NOT NULL,
	"fkGuildId" serial NOT NULL,
	"name" varchar(100) NOT NULL,
	"value" jsonb NOT NULL,
	"recordedAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tblUsers" (
	"id" serial PRIMARY KEY NOT NULL,
	"discordId" char(20) NOT NULL,
	"username" char(32) NOT NULL,
	"joinedDiscord" timestamp with time zone DEFAULT now() NOT NULL,
	"partyMember" boolean NOT NULL,
	CONSTRAINT "tblUsers_discordId_unique" UNIQUE("discordId")
);
--> statement-breakpoint
CREATE TABLE "tblUsersInGuild" (
	"id" serial PRIMARY KEY NOT NULL,
	"fkGuildId" serial NOT NULL,
	"fkUserId" serial NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tblWarnings" (
	"id" serial PRIMARY KEY NOT NULL,
	"fkUserTargetId" serial NOT NULL,
	"fkModeratorId" serial NOT NULL,
	"fkGuildId" serial NOT NULL,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL,
	"comment" varchar(512)
);
--> statement-breakpoint
ALTER TABLE "tblBans" ADD CONSTRAINT "tblBans_fkUserTargetId_tblUsers_id_fk" FOREIGN KEY ("fkUserTargetId") REFERENCES "public"."tblUsers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblBans" ADD CONSTRAINT "tblBans_fkModeratorId_tblUsers_id_fk" FOREIGN KEY ("fkModeratorId") REFERENCES "public"."tblUsers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblBans" ADD CONSTRAINT "tblBans_fkGuildId_tblGuild_id_fk" FOREIGN KEY ("fkGuildId") REFERENCES "public"."tblGuild"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblReports" ADD CONSTRAINT "tblReports_fkUserReportedId_tblUsers_id_fk" FOREIGN KEY ("fkUserReportedId") REFERENCES "public"."tblUsers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblReports" ADD CONSTRAINT "tblReports_fkUserReporterId_tblUsers_id_fk" FOREIGN KEY ("fkUserReporterId") REFERENCES "public"."tblUsers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblReports" ADD CONSTRAINT "tblReports_fkGuildId_tblGuild_id_fk" FOREIGN KEY ("fkGuildId") REFERENCES "public"."tblGuild"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblRoles" ADD CONSTRAINT "tblRoles_fkGuildId_tblGuild_id_fk" FOREIGN KEY ("fkGuildId") REFERENCES "public"."tblGuild"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblStatistics" ADD CONSTRAINT "tblStatistics_fkGuildId_tblGuild_id_fk" FOREIGN KEY ("fkGuildId") REFERENCES "public"."tblGuild"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblUsersInGuild" ADD CONSTRAINT "tblUsersInGuild_fkGuildId_tblGuild_id_fk" FOREIGN KEY ("fkGuildId") REFERENCES "public"."tblGuild"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblUsersInGuild" ADD CONSTRAINT "tblUsersInGuild_fkUserId_tblUsers_id_fk" FOREIGN KEY ("fkUserId") REFERENCES "public"."tblUsers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblWarnings" ADD CONSTRAINT "tblWarnings_fkUserTargetId_tblUsers_id_fk" FOREIGN KEY ("fkUserTargetId") REFERENCES "public"."tblUsers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblWarnings" ADD CONSTRAINT "tblWarnings_fkModeratorId_tblUsers_id_fk" FOREIGN KEY ("fkModeratorId") REFERENCES "public"."tblUsers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tblWarnings" ADD CONSTRAINT "tblWarnings_fkGuildId_tblGuild_id_fk" FOREIGN KEY ("fkGuildId") REFERENCES "public"."tblGuild"("id") ON DELETE no action ON UPDATE no action;