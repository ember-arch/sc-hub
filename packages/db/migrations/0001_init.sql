CREATE TYPE "public"."channel" AS ENUM('LIVE', 'PTU', 'EPTU');--> statement-breakpoint
CREATE TYPE "public"."content_source" AS ENUM('comm_link', 'patch_notes', 'roadmap', 'progress_tracker', 'video', 'spectrum');--> statement-breakpoint
CREATE TYPE "public"."entity_type" AS ENUM('vehicle', 'item', 'manufacturer', 'author');--> statement-breakpoint
CREATE TYPE "public"."item_type" AS ENUM('weapon', 'turret', 'missile_rack', 'missile', 'shield', 'power_plant', 'cooler', 'quantum_drive', 'radar', 'fuel_tank', 'fuel_intake', 'jump_module', 'thruster', 'armor', 'utility', 'mining_laser', 'tractor_beam', 'countermeasure', 'other');--> statement-breakpoint
CREATE TYPE "public"."model_tier" AS ENUM('preview', 'full');--> statement-breakpoint
CREATE TYPE "public"."port_type" AS ENUM('weapon', 'turret', 'missile_rack', 'missile', 'shield', 'power_plant', 'cooler', 'quantum_drive', 'radar', 'fuel_tank', 'fuel_intake', 'jump_module', 'thruster', 'armor', 'utility', 'mining_laser', 'tractor_beam', 'countermeasure', 'other', 'paint', 'interior', 'cargo_grid');--> statement-breakpoint
CREATE TYPE "public"."vehicle_kind" AS ENUM('ship', 'ground_vehicle');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('flight_ready', 'in_production', 'concept');--> statement-breakpoint
CREATE TABLE "author" (
	"id" uuid PRIMARY KEY NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text,
	"first_seen" timestamp with time zone NOT NULL,
	"post_count" integer NOT NULL,
	"takedown" boolean NOT NULL,
	CONSTRAINT "author_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "content_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" "content_source" NOT NULL,
	"external_id" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"body_html" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"revision" integer NOT NULL,
	"author_id" uuid,
	"thread_id" text,
	"thread_title" text,
	"forum" text,
	"takedown" boolean NOT NULL,
	CONSTRAINT "content_item_source_external_id_revision" UNIQUE("source","external_id","revision")
);
--> statement-breakpoint
CREATE TABLE "entity_link" (
	"content_item_id" uuid NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"entity_key" text NOT NULL,
	"matched_text" text NOT NULL,
	"char_start" integer NOT NULL,
	"char_end" integer NOT NULL,
	"confidence" double precision NOT NULL,
	"confirmed" boolean NOT NULL,
	CONSTRAINT "entity_link_content_item_id_entity_type_entity_key_char_start_pk" PRIMARY KEY("content_item_id","entity_type","entity_key","char_start")
);
--> statement-breakpoint
CREATE TABLE "game_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"channel" "channel" NOT NULL,
	"version" text NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"published_at" timestamp with time zone,
	"manifest_url" text NOT NULL,
	"is_current" boolean NOT NULL,
	CONSTRAINT "game_version_channel_version" UNIQUE("channel","version")
);
--> statement-breakpoint
CREATE TABLE "item" (
	"class_name" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"manufacturer_code" text NOT NULL,
	"type" "item_type" NOT NULL,
	"subtype" text,
	"size" integer NOT NULL,
	"grade" text,
	"item_class" text,
	"first_seen_version" text NOT NULL,
	CONSTRAINT "item_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "item_stats" (
	"class_name" text NOT NULL,
	"channel" "channel" NOT NULL,
	"game_version" text NOT NULL,
	"hp" double precision,
	"power_draw" double precision,
	"power_output" double precision,
	"heat_generation" double precision,
	"cooling_rate" double precision,
	"em_signature" double precision,
	"ir_signature" double precision,
	"weapon_damage" double precision,
	"weapon_fire_rate" double precision,
	"weapon_range" double precision,
	"projectile_speed" double precision,
	"shield_hp" double precision,
	"shield_regen" double precision,
	"shield_delay" double precision,
	"qd_speed" double precision,
	"qd_range" double precision,
	"qd_fuel_per_jump" double precision,
	"qd_spool_time" double precision,
	"raw" jsonb NOT NULL,
	CONSTRAINT "item_stats_class_name_channel_game_version_pk" PRIMARY KEY("class_name","channel","game_version")
);
--> statement-breakpoint
CREATE TABLE "manufacturer" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text NOT NULL,
	"logo_asset" text,
	CONSTRAINT "manufacturer_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "model" (
	"class_name" text NOT NULL,
	"channel" "channel" NOT NULL,
	"game_version" text NOT NULL,
	"tier" "model_tier" NOT NULL,
	"url" text NOT NULL,
	"bytes" bigint NOT NULL,
	"triangles" integer NOT NULL,
	"texture_count" integer NOT NULL,
	"checksum" text NOT NULL,
	"takedown" boolean NOT NULL,
	CONSTRAINT "model_class_name_channel_game_version_tier_pk" PRIMARY KEY("class_name","channel","game_version","tier")
);
--> statement-breakpoint
CREATE TABLE "paint" (
	"id" uuid PRIMARY KEY NOT NULL,
	"class_name" text NOT NULL,
	"name" text NOT NULL,
	"preview_asset" text
);
--> statement-breakpoint
CREATE TABLE "port" (
	"class_name" text NOT NULL,
	"channel" "channel" NOT NULL,
	"game_version" text NOT NULL,
	"port_path" text NOT NULL,
	"port_name" text NOT NULL,
	"port_type" "port_type" NOT NULL,
	"size_min" integer NOT NULL,
	"size_max" integer NOT NULL,
	"parent_port_path" text,
	"default_item_class" text,
	"position" text,
	CONSTRAINT "port_class_name_channel_game_version_port_path_pk" PRIMARY KEY("class_name","channel","game_version","port_path")
);
--> statement-breakpoint
CREATE TABLE "vehicle" (
	"class_name" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"manufacturer_code" text NOT NULL,
	"kind" "vehicle_kind" NOT NULL,
	"status" "vehicle_status" NOT NULL,
	"role" text,
	"size_class" text,
	"base_variant_of" text,
	"is_hero" boolean NOT NULL,
	"first_seen_version" text NOT NULL,
	"slug_history" text[] NOT NULL,
	CONSTRAINT "vehicle_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "vehicle_stats" (
	"class_name" text NOT NULL,
	"channel" "channel" NOT NULL,
	"game_version" text NOT NULL,
	"length_m" double precision NOT NULL,
	"beam_m" double precision NOT NULL,
	"height_m" double precision NOT NULL,
	"mass_kg" double precision NOT NULL,
	"cargo_scu" double precision,
	"crew_min" integer NOT NULL,
	"crew_max" integer NOT NULL,
	"hull_hp" double precision,
	"scm_speed" double precision,
	"nav_speed" double precision,
	"hydrogen_fuel" double precision,
	"quantum_fuel" double precision,
	"hydrogen_capacity" double precision,
	"quantum_capacity" double precision,
	"raw" jsonb NOT NULL,
	CONSTRAINT "vehicle_stats_class_name_channel_game_version_pk" PRIMARY KEY("class_name","channel","game_version")
);
--> statement-breakpoint
ALTER TABLE "content_item" ADD CONSTRAINT "content_item_author_id_author_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."author"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entity_link" ADD CONSTRAINT "entity_link_content_item_id_content_item_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item" ADD CONSTRAINT "item_manufacturer_code_manufacturer_code_fk" FOREIGN KEY ("manufacturer_code") REFERENCES "public"."manufacturer"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_stats" ADD CONSTRAINT "item_stats_class_name_item_class_name_fk" FOREIGN KEY ("class_name") REFERENCES "public"."item"("class_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_stats" ADD CONSTRAINT "item_stats_game_version_fk" FOREIGN KEY ("channel","game_version") REFERENCES "public"."game_version"("channel","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model" ADD CONSTRAINT "model_class_name_vehicle_class_name_fk" FOREIGN KEY ("class_name") REFERENCES "public"."vehicle"("class_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model" ADD CONSTRAINT "model_game_version_fk" FOREIGN KEY ("channel","game_version") REFERENCES "public"."game_version"("channel","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paint" ADD CONSTRAINT "paint_class_name_vehicle_class_name_fk" FOREIGN KEY ("class_name") REFERENCES "public"."vehicle"("class_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port" ADD CONSTRAINT "port_class_name_vehicle_class_name_fk" FOREIGN KEY ("class_name") REFERENCES "public"."vehicle"("class_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port" ADD CONSTRAINT "port_default_item_class_item_class_name_fk" FOREIGN KEY ("default_item_class") REFERENCES "public"."item"("class_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port" ADD CONSTRAINT "port_game_version_fk" FOREIGN KEY ("channel","game_version") REFERENCES "public"."game_version"("channel","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "port" ADD CONSTRAINT "port_parent_fk" FOREIGN KEY ("class_name","channel","game_version","parent_port_path") REFERENCES "public"."port"("class_name","channel","game_version","port_path") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_manufacturer_code_manufacturer_code_fk" FOREIGN KEY ("manufacturer_code") REFERENCES "public"."manufacturer"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_base_variant_of_vehicle_class_name_fk" FOREIGN KEY ("base_variant_of") REFERENCES "public"."vehicle"("class_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_stats" ADD CONSTRAINT "vehicle_stats_class_name_vehicle_class_name_fk" FOREIGN KEY ("class_name") REFERENCES "public"."vehicle"("class_name") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicle_stats" ADD CONSTRAINT "vehicle_stats_game_version_fk" FOREIGN KEY ("channel","game_version") REFERENCES "public"."game_version"("channel","version") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "game_version_one_current_per_channel" ON "game_version" USING btree ("channel") WHERE "game_version"."is_current";