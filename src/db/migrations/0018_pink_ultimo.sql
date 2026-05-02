CREATE TABLE "plaud_folders" (
	"user_id" text NOT NULL,
	"plaud_folder_id" varchar(255) NOT NULL,
	"name" text NOT NULL,
	"icon" varchar(16),
	"color" varchar(16),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "plaud_folders_user_id_plaud_folder_id_unique" UNIQUE("user_id","plaud_folder_id")
);
--> statement-breakpoint
ALTER TABLE "recordings" ADD COLUMN "folder_ids" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "plaud_folders" ADD CONSTRAINT "plaud_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "plaud_folders_user_id_idx" ON "plaud_folders" USING btree ("user_id");