import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";
export const appUsers = sqliteTable("app_users",{id:text("id").primaryKey(),username:text("username").notNull(),passwordHash:text("password_hash").notNull(),salt:text("salt").notNull(),role:text("role").notNull(),created:text("created").notNull()},t=>[uniqueIndex("app_users_username").on(t.username)]);
export const sessions = sqliteTable("sessions",{tokenHash:text("token_hash").primaryKey(),user:text("user").notNull().references(()=>appUsers.id),expires:text("expires").notNull(),created:text("created").notNull()},t=>[index("sessions_user").on(t.user),index("sessions_expires").on(t.expires)]);
export const families = sqliteTable("families",{id:text("id").primaryKey(),owner:text("owner").notNull(),name:text("name").notNull(),city:text("city").notNull(),share:integer("share").notNull().default(1),checkTime:text("check_time").notNull().default("10:00"),invite:text("invite").notNull(),created:text("created").notNull()},t=>[uniqueIndex("families_owner").on(t.owner),uniqueIndex("families_invite").on(t.invite)]);
export const members = sqliteTable("members",{user:text("user").primaryKey(),family:text("family").notNull().references(()=>families.id),role:text("role").notNull(),name:text("name").notNull(),phone:text("phone").notNull().default(""),relation:text("relation").notNull().default("")});
export const reminders = sqliteTable("reminders",{id:text("id").primaryKey(),family:text("family").notNull().references(()=>families.id),title:text("title").notNull(),kind:text("kind").notNull(),time:text("time").notNull(),frequency:text("frequency").notNull(),date:text("date").notNull(),weekday:integer("weekday").notNull(),note:text("note").notNull(),active:integer("active").notNull().default(1)},t=>[index("reminders_family").on(t.family)]);
export const occurrences=sqliteTable("occurrences",{id:text("id").primaryKey(),family:text("family").notNull(),reminder:text("reminder").notNull().references(()=>reminders.id),date:text("date").notNull(),status:text("status").notNull(),snooze:text("snooze"),updated:text("updated").notNull()},t=>[uniqueIndex("occurrence_day").on(t.reminder,t.date),index("occurrence_family_day").on(t.family,t.date)]);
export const checkins=sqliteTable("checkins",{id:text("id").primaryKey(),family:text("family").notNull().references(()=>families.id),date:text("date").notNull(),mood:text("mood").notNull(),updated:text("updated").notNull()},t=>[uniqueIndex("checkins_family_day").on(t.family,t.date)]);
export const requests=sqliteTable("requests",{id:text("id").primaryKey(),family:text("family").notNull().references(()=>families.id),status:text("status").notNull(),created:text("created").notNull(),seen:text("seen"),resolved:text("resolved")},t=>[index("requests_family").on(t.family)]);
export const records=sqliteTable("records",{id:text("id").primaryKey(),family:text("family").notNull().references(()=>families.id),date:text("date").notNull(),mood:text("mood").notNull(),sleep:integer("sleep").notNull(),systolic:integer("systolic"),diastolic:integer("diastolic"),note:text("note").notNull(),created:text("created").notNull()},t=>[uniqueIndex("records_family_day").on(t.family,t.date)]);
export const familyNudges=sqliteTable("family_nudges",{
 id:text("id").primaryKey(),family:text("family").notNull().references(()=>families.id),
 reminder:text("reminder").notNull().references(()=>reminders.id),date:text("date").notNull(),
 senderName:text("sender_name").notNull(),senderRelation:text("sender_relation").notNull(),
 due:text("due").notNull(),created:text("created").notNull(),seen:text("seen"),
},t=>[uniqueIndex("family_nudge_day").on(t.reminder,t.date),index("family_nudges_family_day").on(t.family,t.date)]);
export const historyTracking=sqliteTable("history_tracking",{
 family:text("family").primaryKey().references(()=>families.id),startDate:text("start_date").notNull(),startedAt:text("started_at").notNull(),
});
export const reminderRevisions=sqliteTable("reminder_revisions",{
 sequence:integer("sequence").primaryKey({autoIncrement:true}),family:text("family").notNull().references(()=>families.id),
 reminder:text("reminder").notNull().references(()=>reminders.id),effective:text("effective").notNull(),
 title:text("title").notNull(),kind:text("kind").notNull(),time:text("time").notNull(),frequency:text("frequency").notNull(),
 date:text("date").notNull(),weekday:integer("weekday").notNull(),note:text("note").notNull(),active:integer("active").notNull(),
},t=>[index("revision_family_time").on(t.family,t.effective),index("revision_reminder_time").on(t.reminder,t.effective)]);
