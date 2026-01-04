ALTER TABLE "assets_categories" ADD COLUMN "level" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets_categories" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets_categories" ADD COLUMN "position_x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "assets_categories" ADD COLUMN "position_y" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_assets_categories_level" ON "assets_categories" USING btree ("level");