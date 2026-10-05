import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1790843426028 implements MigrationInterface {
    name = 'InitialSchema1790843426028'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."coupons_discounttype_enum" AS ENUM('PERCENTAGE', 'FIXED')`);
        await queryRunner.query(`CREATE TABLE "coupons" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "code" character varying(50) NOT NULL, "eventId" uuid NOT NULL, "discountType" "public"."coupons_discounttype_enum" NOT NULL, "discountValue" numeric(10,2) NOT NULL, "maxUsages" integer NOT NULL, "currentUsages" integer NOT NULL DEFAULT '0', "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "minPurchaseAmount" numeric(10,2), "isActive" boolean NOT NULL DEFAULT true, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_7eb5d9de88285dd5f807ba133c" CHECK ("currentUsages" >= 0 AND "currentUsages" <= "maxUsages"), CONSTRAINT "PK_d7ea8864a0150183770f3e9a8cb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_5886c9139245483c05f43cae9c" ON "coupons" ("code", "eventId") `);
        await queryRunner.query(`CREATE TABLE "events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(200) NOT NULL, "description" text NOT NULL, "location" character varying(500) NOT NULL, "startDate" TIMESTAMP WITH TIME ZONE NOT NULL, "endDate" TIMESTAMP WITH TIME ZONE NOT NULL, "capacity" integer NOT NULL, "availableSeats" integer NOT NULL, "ticketPrice" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'THB', "imageUrl" character varying(2048), "organizerId" uuid, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_ec185fd5fc7e86f78d2e53e7b1" CHECK ("availableSeats" >= 0 AND "availableSeats" <= "capacity"), CONSTRAINT "PK_40731c7151fe4be3116e45ddf73" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_89790086fbc0aa80d8cf577285" ON "events" ("startDate") `);
        await queryRunner.query(`CREATE INDEX "IDX_1024d476207981d1c72232cf3c" ON "events" ("organizerId") `);
        await queryRunner.query(`CREATE TABLE "tickets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "bookingId" uuid NOT NULL, "ticketNumber" character varying(50) NOT NULL, "qrCode" character varying(128) NOT NULL, "isValidated" boolean NOT NULL DEFAULT false, "validatedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_343bc942ae261cf7a1377f48fd0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_245de798229ec6e66bb9312f28" ON "tickets" ("bookingId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_e99bd0f51b92896fdaf99ebb71" ON "tickets" ("ticketNumber") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_fededfa934cf8d7214adfa6c82" ON "tickets" ("qrCode") `);
        await queryRunner.query(`CREATE TYPE "public"."bookings_status_enum" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED', 'EXPIRED')`);
        await queryRunner.query(`CREATE TABLE "bookings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "eventId" uuid NOT NULL, "quantity" integer NOT NULL, "email" character varying(255) NOT NULL, "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "totalAmount" numeric(10,2) NOT NULL, "finalAmount" numeric(10,2) NOT NULL, "discount" numeric(10,2) NOT NULL DEFAULT '0', "couponCode" character varying(50), "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'PENDING', "paymentIntentId" character varying, "userId" uuid, "clientSecret" text, "expiresAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_f95d476ef16fad91a50544b60c" ON "bookings" ("eventId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_ac4e35167f7c1b0f5d3defe333" ON "bookings" ("paymentIntentId") WHERE "paymentIntentId" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_38a69a58a323647f2e75eb994d" ON "bookings" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_7d895a3f015624351717b1ef0a" ON "bookings" ("status", "expiresAt") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('ADMIN', 'ORGANIZER', 'CUSTOMER')`);
        await queryRunner.query(`CREATE TYPE "public"."users_provider_enum" AS ENUM('LOCAL', 'GOOGLE', 'GITHUB', 'FACEBOOK')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "password_hash" character varying, "firstName" character varying(100) NOT NULL, "lastName" character varying(100) NOT NULL, "avatarUrl" character varying(512), "role" "public"."users_role_enum" NOT NULL DEFAULT 'CUSTOMER', "provider" "public"."users_provider_enum" NOT NULL DEFAULT 'LOCAL', "providerId" character varying(255), "isEmailVerified" boolean NOT NULL DEFAULT false, "emailVerificationToken" character(64), "emailVerificationExpires" TIMESTAMP WITH TIME ZONE, "passwordResetToken" character(64), "passwordResetExpires" TIMESTAMP WITH TIME ZONE, "isActive" boolean NOT NULL DEFAULT true, "lastLoginAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`CREATE INDEX "IDX_7ad75a333a7bcf6a2b5d3517ca" ON "users" ("emailVerificationToken") `);
        await queryRunner.query(`CREATE INDEX "IDX_bffe933a388d6bde48891ff95a" ON "users" ("passwordResetToken") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8be20ec8e4944d95229ce915bd" ON "users" ("provider", "providerId") WHERE "providerId" IS NOT NULL`);
        await queryRunner.query(`CREATE TABLE "auth_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "accessTokenHash" character(64) NOT NULL, "accessExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "refreshTokenHash" character(64) NOT NULL, "refreshExpiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "previousRefreshTokenHash" character(64), "rotatedAt" TIMESTAMP WITH TIME ZONE, "ipAddress" character varying(64), "userAgent" character varying(512), "revokedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_641507381f32580e8479efc36cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_27541b101cad6c7c1a8f23f5e1" ON "auth_sessions" ("accessTokenHash") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_167b8001a5a5b2aa5ffb94bb5e" ON "auth_sessions" ("refreshTokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_812fea4c9b35a452a879cb83e2" ON "auth_sessions" ("previousRefreshTokenHash") `);
        await queryRunner.query(`CREATE INDEX "IDX_7939a9f08c3bb6f5e84a93a1c4" ON "auth_sessions" ("userId", "revokedAt") `);
        await queryRunner.query(`ALTER TABLE "coupons" ADD CONSTRAINT "FK_1333c687be50e828f38e8c192c0" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "events" ADD CONSTRAINT "FK_1024d476207981d1c72232cf3ca" FOREIGN KEY ("organizerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tickets" ADD CONSTRAINT "FK_245de798229ec6e66bb9312f284" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_f95d476ef16fad91a50544b60c3" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_38a69a58a323647f2e75eb994de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "auth_sessions" ADD CONSTRAINT "FK_925b24d7fc2f9324ce972aee025" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "auth_sessions" DROP CONSTRAINT "FK_925b24d7fc2f9324ce972aee025"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_38a69a58a323647f2e75eb994de"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_f95d476ef16fad91a50544b60c3"`);
        await queryRunner.query(`ALTER TABLE "tickets" DROP CONSTRAINT "FK_245de798229ec6e66bb9312f284"`);
        await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_1024d476207981d1c72232cf3ca"`);
        await queryRunner.query(`ALTER TABLE "coupons" DROP CONSTRAINT "FK_1333c687be50e828f38e8c192c0"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7939a9f08c3bb6f5e84a93a1c4"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_812fea4c9b35a452a879cb83e2"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_167b8001a5a5b2aa5ffb94bb5e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_27541b101cad6c7c1a8f23f5e1"`);
        await queryRunner.query(`DROP TABLE "auth_sessions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8be20ec8e4944d95229ce915bd"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_bffe933a388d6bde48891ff95a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7ad75a333a7bcf6a2b5d3517ca"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_provider_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7d895a3f015624351717b1ef0a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_38a69a58a323647f2e75eb994d"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_ac4e35167f7c1b0f5d3defe333"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f95d476ef16fad91a50544b60c"`);
        await queryRunner.query(`DROP TABLE "bookings"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_fededfa934cf8d7214adfa6c82"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e99bd0f51b92896fdaf99ebb71"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_245de798229ec6e66bb9312f28"`);
        await queryRunner.query(`DROP TABLE "tickets"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1024d476207981d1c72232cf3c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_89790086fbc0aa80d8cf577285"`);
        await queryRunner.query(`DROP TABLE "events"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_5886c9139245483c05f43cae9c"`);
        await queryRunner.query(`DROP TABLE "coupons"`);
        await queryRunner.query(`DROP TYPE "public"."coupons_discounttype_enum"`);
    }

}
