--
-- PostgreSQL database dump
--

\restrict tJwIPR5yJlEn0MEWMlLwtpJ5Qr9K13lmzqW1X5Zb0RkUnaU7bmJKjmx3NlPcT6u

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: AppointmentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AppointmentStatus" AS ENUM (
    'PENDING',
    'CONFIRMED',
    'REJECTED',
    'CANCELLED',
    'NO_SHOW'
);


ALTER TYPE public."AppointmentStatus" OWNER TO postgres;

--
-- Name: AuditAction; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."AuditAction" AS ENUM (
    'CREATE',
    'UPDATE',
    'DELETE',
    'STATUS_CHANGE',
    'PAYMENT_CHANGE',
    'STOCK_CHANGE',
    'ITEM_ADDED',
    'ITEM_REMOVED',
    'LOGIN',
    'LOGOUT',
    'OTHER',
    'ITEM_UPDATED'
);


ALTER TYPE public."AuditAction" OWNER TO postgres;

--
-- Name: BillingPeriod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."BillingPeriod" AS ENUM (
    'MONTH',
    'QUARTER',
    'YEAR'
);


ALTER TYPE public."BillingPeriod" OWNER TO postgres;

--
-- Name: DevicePlatform; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DevicePlatform" AS ENUM (
    'WEB',
    'ANDROID',
    'IOS'
);


ALTER TYPE public."DevicePlatform" OWNER TO postgres;

--
-- Name: DiagnosticType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."DiagnosticType" AS ENUM (
    'INTAKE',
    'POST_SERVICE',
    'ROUTINE',
    'DAMAGE_REPORT'
);


ALTER TYPE public."DiagnosticType" OWNER TO postgres;

--
-- Name: ItemKind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ItemKind" AS ENUM (
    'LABOR',
    'DIAGNOSTIC',
    'PART',
    'FEE'
);


ALTER TYPE public."ItemKind" OWNER TO postgres;

--
-- Name: OrderPaymentMethod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderPaymentMethod" AS ENUM (
    'QPAY',
    'CASH',
    'BANK_TRANSFER',
    'OTHER'
);


ALTER TYPE public."OrderPaymentMethod" OWNER TO postgres;

--
-- Name: OrderPaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderPaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'CANCELLED',
    'FAILED'
);


ALTER TYPE public."OrderPaymentStatus" OWNER TO postgres;

--
-- Name: OrderStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OrderStatus" AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'WAITING_PARTS',
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public."OrderStatus" OWNER TO postgres;

--
-- Name: OtpType; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."OtpType" AS ENUM (
    'SIGNUP',
    'CHANGE_PASSWORD',
    'RESET_PASSWORD',
    'CONSUMER_LOGIN',
    'SET_PASSWORD'
);


ALTER TYPE public."OtpType" OWNER TO postgres;

--
-- Name: PaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PaymentStatus" AS ENUM (
    'UNPAID',
    'PARTIAL',
    'PAID'
);


ALTER TYPE public."PaymentStatus" OWNER TO postgres;

--
-- Name: Plan; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Plan" AS ENUM (
    'FREE',
    'BUSINESS',
    'ENTERPRISE'
);


ALTER TYPE public."Plan" OWNER TO postgres;

--
-- Name: PlanLimitKind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."PlanLimitKind" AS ENUM (
    'COUNT',
    'BOOLEAN'
);


ALTER TYPE public."PlanLimitKind" OWNER TO postgres;

--
-- Name: ServiceKind; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."ServiceKind" AS ENUM (
    'LABOR',
    'DIAGNOSTIC',
    'GOODS'
);


ALTER TYPE public."ServiceKind" OWNER TO postgres;

--
-- Name: SubscriptionPaymentMethod; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubscriptionPaymentMethod" AS ENUM (
    'QPAY',
    'BANK_TRANSFER',
    'CASH',
    'OTHER'
);


ALTER TYPE public."SubscriptionPaymentMethod" OWNER TO postgres;

--
-- Name: SubscriptionPaymentStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubscriptionPaymentStatus" AS ENUM (
    'PENDING',
    'PAID',
    'CANCELLED',
    'FAILED'
);


ALTER TYPE public."SubscriptionPaymentStatus" OWNER TO postgres;

--
-- Name: SubscriptionStatus; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."SubscriptionStatus" AS ENUM (
    'TRIAL',
    'ACTIVE',
    'EXPIRED',
    'CANCELLED'
);


ALTER TYPE public."SubscriptionStatus" OWNER TO postgres;

--
-- Name: Weekday; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public."Weekday" AS ENUM (
    'SUN',
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT'
);


ALTER TYPE public."Weekday" OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Account; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Account" (
    id text NOT NULL,
    phone text NOT NULL,
    name text,
    email text,
    "avatarUrl" text,
    "isActive" boolean DEFAULT true NOT NULL,
    "lastLoginAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Account" OWNER TO postgres;

--
-- Name: AccountVehicle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AccountVehicle" (
    id text NOT NULL,
    plate text NOT NULL,
    make text NOT NULL,
    model text NOT NULL,
    year integer,
    vin text,
    "fuelType" text,
    mileage integer,
    "accountId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "wheelPosition" text
);


ALTER TABLE public."AccountVehicle" OWNER TO postgres;

--
-- Name: Appointment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Appointment" (
    id text NOT NULL,
    status public."AppointmentStatus" DEFAULT 'PENDING'::public."AppointmentStatus" NOT NULL,
    "requestedAt" timestamp(3) without time zone NOT NULL,
    note text,
    "tenantId" text NOT NULL,
    "branchId" text NOT NULL,
    "accountId" text,
    "customerId" text,
    "serviceOrderId" text,
    "respondedAt" timestamp(3) without time zone,
    "respondedById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "accountVehicleId" text,
    "vehicleId" text,
    "reminderSentAt" timestamp(3) without time zone
);


ALTER TABLE public."Appointment" OWNER TO postgres;

--
-- Name: AuditLog; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."AuditLog" (
    id text NOT NULL,
    entity text NOT NULL,
    "entityId" text NOT NULL,
    action public."AuditAction" NOT NULL,
    summary text,
    before jsonb,
    after jsonb,
    "tenantId" text NOT NULL,
    "userId" text,
    "branchId" text,
    "ipAddress" text,
    "userAgent" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."AuditLog" OWNER TO postgres;

--
-- Name: Branch; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Branch" (
    id text NOT NULL,
    name text NOT NULL,
    phone text,
    "isPrimary" boolean DEFAULT false NOT NULL,
    city text,
    district text,
    khoroo text,
    address text,
    latitude double precision,
    longitude double precision,
    "openTime" text,
    "closeTime" text,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "slotCapacity" integer,
    "slotMinutes" integer
);


ALTER TABLE public."Branch" OWNER TO postgres;

--
-- Name: BranchSchedule; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."BranchSchedule" (
    id text NOT NULL,
    weekday public."Weekday" NOT NULL,
    "isOpen" boolean DEFAULT false NOT NULL,
    "openTime" text,
    "closeTime" text,
    "branchId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."BranchSchedule" OWNER TO postgres;

--
-- Name: Customer; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Customer" (
    id text NOT NULL,
    "fullName" text NOT NULL,
    phone text NOT NULL,
    email text,
    note text,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "accountId" text
);


ALTER TABLE public."Customer" OWNER TO postgres;

--
-- Name: Device; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Device" (
    id text NOT NULL,
    "deviceId" text NOT NULL,
    platform public."DevicePlatform" NOT NULL,
    "firebaseToken" text,
    name text,
    model text,
    os text,
    "userId" text,
    "accountId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."Device" OWNER TO postgres;

--
-- Name: DiagnosticReport; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DiagnosticReport" (
    id text NOT NULL,
    "templateVersion" integer NOT NULL,
    data jsonb NOT NULL,
    "signatureUrl" text,
    "mileageAtReport" integer,
    notes text,
    "tenantId" text NOT NULL,
    "templateId" text NOT NULL,
    "orderId" text,
    "customerId" text NOT NULL,
    "vehicleId" text NOT NULL,
    "branchId" text NOT NULL,
    "filledById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DiagnosticReport" OWNER TO postgres;

--
-- Name: DiagnosticTemplate; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."DiagnosticTemplate" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    type public."DiagnosticType" NOT NULL,
    schema jsonb NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    price numeric(12,2),
    "durationMin" integer,
    "tenantId" text NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."DiagnosticTemplate" OWNER TO postgres;

--
-- Name: LaborCategory; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."LaborCategory" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."LaborCategory" OWNER TO postgres;

--
-- Name: Notification; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Notification" (
    id text NOT NULL,
    "tenantId" text,
    "userId" text,
    "accountId" text,
    type text NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    data jsonb,
    "dedupeKey" text,
    "readAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT notification_owner_xor CHECK ((((("userId" IS NOT NULL))::integer + (("accountId" IS NOT NULL))::integer) = 1))
);


ALTER TABLE public."Notification" OWNER TO postgres;

--
-- Name: OrderDiagnostic; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OrderDiagnostic" (
    id text NOT NULL,
    "orderId" text NOT NULL,
    "templateId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."OrderDiagnostic" OWNER TO postgres;

--
-- Name: OrderPayment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."OrderPayment" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    "orderId" text NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'MNT'::text NOT NULL,
    method public."OrderPaymentMethod" DEFAULT 'QPAY'::public."OrderPaymentMethod" NOT NULL,
    status public."OrderPaymentStatus" DEFAULT 'PENDING'::public."OrderPaymentStatus" NOT NULL,
    "qpayInvoiceId" text,
    "qpayPaymentId" text,
    "qrImage" text,
    "qrText" text,
    "paidAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "qpayUrls" jsonb
);


ALTER TABLE public."OrderPayment" OWNER TO postgres;

--
-- Name: Otp; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Otp" (
    id text NOT NULL,
    email text,
    "codeHash" text NOT NULL,
    type public."OtpType" NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    "consumedAt" timestamp(3) without time zone,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "userId" text,
    ip text,
    "userAgent" text,
    "accountId" text,
    phone text
);


ALTER TABLE public."Otp" OWNER TO postgres;

--
-- Name: PlanFeature; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlanFeature" (
    id text NOT NULL,
    plan public."Plan" NOT NULL,
    label text NOT NULL,
    value text NOT NULL,
    description text,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    highlighted boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PlanFeature" OWNER TO postgres;

--
-- Name: PlanLimit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlanLimit" (
    id text NOT NULL,
    plan public."Plan" NOT NULL,
    code text NOT NULL,
    label text NOT NULL,
    description text,
    kind public."PlanLimitKind" DEFAULT 'COUNT'::public."PlanLimitKind" NOT NULL,
    "intValue" integer,
    "boolValue" boolean,
    "sortOrder" integer DEFAULT 0 NOT NULL,
    highlighted boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PlanLimit" OWNER TO postgres;

--
-- Name: PlanPrice; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlanPrice" (
    id text NOT NULL,
    plan public."Plan" NOT NULL,
    period public."BillingPeriod" NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'MNT'::text NOT NULL,
    "isActive" boolean DEFAULT true NOT NULL,
    notes text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PlanPrice" OWNER TO postgres;

--
-- Name: PlatformSetting; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."PlatformSetting" (
    id text DEFAULT 'default'::text NOT NULL,
    "facebookUrl" text,
    "youtubeUrl" text,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."PlatformSetting" OWNER TO postgres;

--
-- Name: QPaySettings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."QPaySettings" (
    id integer DEFAULT 1 NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    "invoiceCode" text NOT NULL,
    "callbackUrl" text,
    "accessToken" text,
    "refreshToken" text,
    "tokenExpiresAt" timestamp(3) without time zone,
    "refreshTokenExpiresAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."QPaySettings" OWNER TO postgres;

--
-- Name: RefreshToken; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."RefreshToken" (
    id text NOT NULL,
    "tokenHash" text NOT NULL,
    "userId" text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone,
    "replacedById" text,
    "userAgent" text,
    ip text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastUsedAt" timestamp(3) without time zone
);


ALTER TABLE public."RefreshToken" OWNER TO postgres;

--
-- Name: Role; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Role" (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    permissions text[],
    "isActive" boolean DEFAULT true NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Role" OWNER TO postgres;

--
-- Name: Service; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Service" (
    id text NOT NULL,
    type public."ServiceKind" NOT NULL,
    name text NOT NULL,
    code text,
    price numeric(12,2) NOT NULL,
    "costPrice" numeric(12,2),
    stock numeric(12,3),
    description text,
    "isActive" boolean DEFAULT true NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "laborCategoryId" text,
    "unitId" text,
    "durationValue" numeric(12,3),
    "durationUnitId" text
);


ALTER TABLE public."Service" OWNER TO postgres;

--
-- Name: ServiceItem; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ServiceItem" (
    id text NOT NULL,
    kind public."ItemKind" NOT NULL,
    description text NOT NULL,
    quantity numeric(12,3) DEFAULT 1 NOT NULL,
    "unitPrice" numeric(12,2) NOT NULL,
    total numeric(12,2) NOT NULL,
    "orderId" text NOT NULL,
    "serviceId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public."ServiceItem" OWNER TO postgres;

--
-- Name: ServiceOrder; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."ServiceOrder" (
    id text NOT NULL,
    number text NOT NULL,
    status public."OrderStatus" DEFAULT 'SCHEDULED'::public."OrderStatus" NOT NULL,
    "paymentStatus" public."PaymentStatus" DEFAULT 'UNPAID'::public."PaymentStatus" NOT NULL,
    "scheduledAt" timestamp(3) without time zone,
    "startedAt" timestamp(3) without time zone,
    "completedAt" timestamp(3) without time zone,
    "paidAt" timestamp(3) without time zone,
    notes text,
    "totalAmount" numeric(12,2),
    "paidAmount" numeric(12,2),
    "tenantId" text NOT NULL,
    "branchId" text NOT NULL,
    "customerId" text NOT NULL,
    "vehicleId" text NOT NULL,
    "assignedToId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."ServiceOrder" OWNER TO postgres;

--
-- Name: Subscription; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Subscription" (
    id text NOT NULL,
    plan public."Plan" NOT NULL,
    status public."SubscriptionStatus" NOT NULL,
    "startsAt" timestamp(3) without time zone NOT NULL,
    "endsAt" timestamp(3) without time zone,
    amount numeric(12,2),
    notes text,
    "cancelledAt" timestamp(3) without time zone,
    "tenantId" text NOT NULL,
    "createdById" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Subscription" OWNER TO postgres;

--
-- Name: SubscriptionPayment; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SubscriptionPayment" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    plan public."Plan" NOT NULL,
    period public."BillingPeriod" NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency text DEFAULT 'MNT'::text NOT NULL,
    "planPriceId" text,
    method public."SubscriptionPaymentMethod" DEFAULT 'QPAY'::public."SubscriptionPaymentMethod" NOT NULL,
    status public."SubscriptionPaymentStatus" DEFAULT 'PENDING'::public."SubscriptionPaymentStatus" NOT NULL,
    "qpayInvoiceId" text,
    "qpayPaymentId" text,
    "qrImage" text,
    "qrText" text,
    "paidAt" timestamp(3) without time zone,
    "createdSubscriptionId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SubscriptionPayment" OWNER TO postgres;

--
-- Name: SuperAdmin; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."SuperAdmin" (
    id text NOT NULL,
    email text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    "passwordHash" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."SuperAdmin" OWNER TO postgres;

--
-- Name: Tenant; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Tenant" (
    id text NOT NULL,
    slug text NOT NULL,
    name text NOT NULL,
    "registerNumber" text NOT NULL,
    email text NOT NULL,
    phone1 text NOT NULL,
    phone2 text,
    "logoUrl" text,
    plan public."Plan" DEFAULT 'FREE'::public."Plan" NOT NULL,
    suspended boolean DEFAULT false NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "acceptsOnlineBooking" boolean DEFAULT false NOT NULL
);


ALTER TABLE public."Tenant" OWNER TO postgres;

--
-- Name: TenantQPaySettings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."TenantQPaySettings" (
    id text NOT NULL,
    "tenantId" text NOT NULL,
    username text NOT NULL,
    password text NOT NULL,
    "invoiceCode" text NOT NULL,
    "callbackUrl" text,
    enabled boolean DEFAULT true NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "tokenExpiresAt" timestamp(3) without time zone,
    "refreshTokenExpiresAt" timestamp(3) without time zone,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."TenantQPaySettings" OWNER TO postgres;

--
-- Name: Unit; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Unit" (
    id text NOT NULL,
    name text NOT NULL,
    code text,
    "isActive" boolean DEFAULT true NOT NULL,
    "tenantId" text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);


ALTER TABLE public."Unit" OWNER TO postgres;

--
-- Name: User; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."User" (
    id text NOT NULL,
    email text NOT NULL,
    "firstName" text NOT NULL,
    "lastName" text NOT NULL,
    phone text NOT NULL,
    "passwordHash" text,
    "tenantId" text NOT NULL,
    "branchId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "failedLoginAttempts" integer DEFAULT 0 NOT NULL,
    "lockedAt" timestamp(3) without time zone,
    "activeUntil" timestamp(3) without time zone,
    "isActive" boolean DEFAULT true NOT NULL,
    "isOwner" boolean DEFAULT false NOT NULL,
    "roleId" text,
    verified boolean DEFAULT false NOT NULL
);


ALTER TABLE public."User" OWNER TO postgres;

--
-- Name: UserSession; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."UserSession" (
    id text NOT NULL,
    "userId" text NOT NULL,
    "userAgent" text,
    ip text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "lastSeenAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "revokedAt" timestamp(3) without time zone
);


ALTER TABLE public."UserSession" OWNER TO postgres;

--
-- Name: Vehicle; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public."Vehicle" (
    id text NOT NULL,
    plate text NOT NULL,
    vin text,
    make text NOT NULL,
    model text NOT NULL,
    year integer,
    mileage integer,
    "tenantId" text NOT NULL,
    "customerId" text,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "fuelType" text,
    "wheelPosition" text
);


ALTER TABLE public."Vehicle" OWNER TO postgres;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


ALTER TABLE public._prisma_migrations OWNER TO postgres;

--
-- Data for Name: Account; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Account" (id, phone, name, email, "avatarUrl", "isActive", "lastLoginAt", "createdAt", "updatedAt") FROM stdin;
cmq0kykze0001asighmaiuvi9	90908888	\N	\N	\N	t	2026-06-05 07:05:56.665	2026-06-05 07:05:56.666	2026-06-05 07:05:56.666
cmq0iqvi000050wig4qtz67se	95733832	Myagmardorj Naimanjin	\N	\N	t	2026-06-09 02:58:22.056	2026-06-05 06:03:57.816	2026-06-09 02:58:22.057
cmq8x7sgf0004hsigixytib0v	99004322	\N	\N	\N	t	2026-06-11 03:11:11.051	2026-06-11 03:11:11.056	2026-06-11 03:11:11.056
cmq9moi03000mtsigntztk94s	99509510	\N	\N	\N	t	2026-06-11 15:04:01.059	2026-06-11 15:04:01.059	2026-06-11 15:04:01.059
\.


--
-- Data for Name: AccountVehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AccountVehicle" (id, plate, make, model, year, vin, "fuelType", mileage, "accountId", "createdAt", "updatedAt", "wheelPosition") FROM stdin;
cmq0lmwgi0000i0igt3kmnr2q	9922УКУ	LEXUS	RX450h	2014	GYL162406595	Бензин - Цахилгаан	\N	cmq0kykze0001asighmaiuvi9	2026-06-05 07:24:51.282	2026-06-05 07:24:51.282	Баруун
cmq0ln89t0002i0igm4nurjqs	9922УКА	Toyota	Land Cruiser Prado	2022	TRJ1500157583	Бензин	\N	cmq0kykze0001asighmaiuvi9	2026-06-05 07:25:06.593	2026-06-05 07:25:06.593	Баруун
cmq9mq899000ntsig282tvj1g	1122УАН	LEXUS	RX450h	2009	GYL152001581	Бензин - Hybrid	\N	cmq9moi03000mtsigntztk94s	2026-06-11 15:05:21.741	2026-06-11 15:05:21.741	Баруун
\.


--
-- Data for Name: Appointment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Appointment" (id, status, "requestedAt", note, "tenantId", "branchId", "accountId", "customerId", "serviceOrderId", "respondedAt", "respondedById", "createdAt", "updatedAt", "accountVehicleId", "vehicleId", "reminderSentAt") FROM stdin;
cmq0g0b8t00000wigh3lsmi96	CONFIRMED	2026-06-05 01:00:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	\N	cmpw2vzqm00037gigjvzm2ggo	\N	2026-06-05 04:47:19.27	cmpp3f50i000l0kigcn8nely8	2026-06-05 04:47:19.277	2026-06-05 04:47:19.277	\N	\N	\N
cmq0g7lvt00020wig3tzpy3dz	CONFIRMED	2026-06-08 01:00:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	\N	cmpxf9px0000958iged59vy6g	\N	2026-06-05 04:52:59.656	cmpp3f50i000l0kigcn8nely8	2026-06-05 04:52:59.657	2026-06-05 04:52:59.657	\N	\N	\N
cmq0itb5q0001qcign2yfcxyx	CONFIRMED	2026-06-10 01:00:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmq0iqvi000050wig4qtz67se	cmpp97fuu000xskigwzjjipz4	\N	2026-06-05 06:06:04.043	cmpp3f50i000l0kigcn8nely8	2026-06-05 06:05:51.422	2026-06-05 06:06:04.044	\N	\N	\N
cmq0o0rap0000wgig6gqd69lp	CANCELLED	2026-06-09 01:31:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmq0iqvi000050wig4qtz67se	\N	\N	\N	\N	2026-06-05 08:31:37.009	2026-06-05 09:51:16.707	\N	\N	\N
cmq0pkgp1000hwgig9ok0ijff	CANCELLED	2026-06-08 05:30:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmq0iqvi000050wig4qtz67se	\N	\N	\N	\N	2026-06-05 09:14:56.005	2026-06-05 09:51:18.332	\N	\N	\N
cmq61vx4z0002zcigbo0auuu0	PENDING	2026-06-18 07:30:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmq0iqvi000050wig4qtz67se	\N	\N	\N	\N	2026-06-09 02:58:36.803	2026-06-09 02:58:36.803	\N	\N	\N
cmq0qv4as0016wgigpuz6d62h	CONFIRMED	2026-06-25 11:00:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmq0iqvi000050wig4qtz67se	cmpp97fuu000xskigwzjjipz4	\N	2026-06-10 03:21:26.532	cmpp3f50i000l0kigcn8nely8	2026-06-05 09:51:12.772	2026-06-10 03:21:26.534	\N	\N	\N
cmq8x8d1d0005hsigap4jxacf	PENDING	2026-06-25 08:00:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmq8x7sgf0004hsigixytib0v	\N	\N	\N	\N	2026-06-11 03:11:37.729	2026-06-11 03:11:37.729	\N	\N	\N
cmq9mr6p7000otsig6mq9td2w	CONFIRMED	2026-06-12 08:00:00	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmq9moi03000mtsigntztk94s	cmq9mryhz000qtsigbvlytwus	cmq9msl9w000utsigh2bswdtl	2026-06-11 15:06:42.419	cmpp3f50i000l0kigcn8nely8	2026-06-11 15:06:06.379	2026-06-11 15:07:11.943	cmq9mq899000ntsig282tvj1g	cmq9mryi6000rtsigeoigbxx7	\N
\.


--
-- Data for Name: AuditLog; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."AuditLog" (id, entity, "entityId", action, summary, before, after, "tenantId", "userId", "branchId", "ipAddress", "userAgent", "createdAt") FROM stdin;
cmpp3gagw000n0kigwtw5bzz1	Role	cmpp3gago000m0kig24uiqlvj	CREATE	Засварчин · 7 эрх	\N	{"name": "Засварчин", "isActive": true, "permissions": ["customers.manage", "vehicles.manage", "services.manage", "diagnostics.manage", "orders.manage", "orders.assignable", "payments.manage"]}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 06:10:21.824
cmpp3ho1k000p0kiglo4o04ap	Role	cmpp3ho1f000o0kigaimf8mnr	CREATE	Кассчин · 8 эрх	\N	{"name": "Кассчин", "isActive": true, "permissions": ["customers.manage", "vehicles.manage", "services.manage", "diagnostics.manage", "orders.manage", "orders.assignable", "payments.manage", "audit.view"]}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 06:11:26.072
cmpp3orc3000q0kigro0b2gok	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 06:16:56.931
cmpp64mf30000wkigy8muj40d	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 07:25:16.287
cmpp64p950001wkigwqudta4p	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 07:25:19.961
cmpp65qa90003wkigi7iugg6t	User	cmpp65q9z0002wkiggzquyx9n	CREATE	Naimanjin Myagmardorj · Засварчин	\N	{"email": "act@a.mn", "roleId": "cmpp3gago000m0kig24uiqlvj", "branchId": "cmpp3f4zw000d0kiggeq0lcat", "lastName": "Naimanjin", "firstName": "Myagmardorj"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 07:26:07.953
cmpp8of7z000awkig7r20iivi	Role	cmpp3gago000m0kig24uiqlvj	UPDATE	Засварчин · 18 эрх	{"name": "Засварчин", "isActive": true, "permissions": ["customers.manage", "vehicles.manage", "services.manage", "diagnostics.manage", "orders.manage", "orders.assignable", "payments.manage"]}	{"name": "Засварчин", "isActive": true, "permissions": ["customers.view", "customers.create", "customers.edit", "customers.delete", "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete", "services.view", "services.create", "services.edit", "services.delete", "diagnostics.view", "diagnostics.create", "diagnostics.edit", "diagnostics.delete", "orders.view", "orders.create"]}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:36:39.311
cmpp90ph50009skigkizt180s	LaborCategory	cmpp90ph00008skigohfh8dp5	CREATE	Ангилал-1	\N	{"name": "Ангилал-1", "isActive": true, "description": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:46:12.473
cmpp90xuo000bskigvvdbkxnc	LaborCategory	cmpp90xuj000askigd8v7w2pb	CREATE	Хөдөлгүүр	\N	{"name": "Хөдөлгүүр", "isActive": true, "description": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:46:23.328
cmpp917sw000dskig4e42u1yy	LaborCategory	cmpp917sl000cskigf5xlf3a7	CREATE	Тоормос	\N	{"name": "Тоормос", "isActive": true, "description": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:46:36.224
cmpp91xe1000fskigtgh7argk	Service	cmpp91xdt000eskigq5vadzir	CREATE	[LABOR] Тос солих	\N	{"code": null, "name": "Тос солих", "type": "LABOR", "price": "50000", "stock": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:47:09.385
cmpp973p3000wskigix4gcihp	Tenant	cmpp3f4zb00020kigzdmly5ii	UPDATE	QPay тохиргоо нэмэв	\N	{"enabled": true, "username": "INFOSYSTEMS", "invoiceCode": "INFOSYSTEMS_INVOICE"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:51:10.839
cmpp97fv1000yskigqtihlclx	Customer	cmpp97fuu000xskigwzjjipz4	CREATE	Myagmardorj Naimanjin (захиалгаас түргэн)	\N	{"note": null, "email": "jijgee647@gmail.com", "phone": "95733832", "fullName": "Myagmardorj Naimanjin"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:51:26.605
cmpp97qo70010skighskh11nd	Vehicle	cmpp97qo0000zskiglwc4hrj5	CREATE	8292УАС · Toyota Prius Alpha (захиалгаас түргэн)	\N	{"make": "Toyota", "year": 2012, "model": "Prius Alpha", "plate": "8292УАС", "fuelType": "Бензин - Цахилгаан", "customerId": "cmpp97fuu000xskigwzjjipz4"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:51:40.615
cmpp97sy60012skigb40bbso8	ServiceOrder	cmpp97sxv0011skigp5jl7f7x	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpp3f4zw000d0kiggeq0lcat", "vehicleId": "cmpp97qo0000zskiglwc4hrj5", "customerId": "cmpp97fuu000xskigwzjjipz4", "scheduledAt": "2026-05-28T08:51:00.000Z", "assignedToId": "cmpp3f50i000l0kigcn8nely8"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:51:43.566
cmpp97xw40014skigw1ojxcjj	ServiceOrder	cmpp97sxv0011skigp5jl7f7x	ITEM_ADDED	LABOR · Тос солих × 1 @ 50000	\N	{"kind": "LABOR", "total": "50000", "itemId": "cmpp97xvz0013skigc5zvlvn9", "quantity": "1", "serviceId": "cmpp91xdt000eskigq5vadzir", "unitPrice": "50000", "description": "Тос солих"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:51:49.972
cmpp984290016skiga6ip7fr3	ServiceOrder	cmpp97sxv0011skigp5jl7f7x	PAYMENT_CHANGE	QPay QR үүсгэв · 50000₮	\N	{"amount": "50000", "paymentId": "cmpp983tq0015skig0s0osdbu"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:51:57.969
cmpp9bc1x0018skig6m7asflj	Service	cmpp9bc1s0017skigx87sxubm	CREATE	[LABOR] Naklad solih	\N	{"code": null, "name": "Naklad solih", "type": "LABOR", "price": "20000", "stock": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:54:28.293
cmpp9bqlo001askighslyhgb2	ServiceOrder	cmpp97sxv0011skigp5jl7f7x	ITEM_ADDED	LABOR · Naklad solih × 1 @ 20000	\N	{"kind": "LABOR", "total": "20000", "itemId": "cmpp9bqll0019skig329a06hb", "quantity": "1", "serviceId": "cmpp9bc1s0017skigx87sxubm", "unitPrice": "20000", "description": "Naklad solih"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:54:47.148
cmpp9e30k001cskigmlmubb7x	DiagnosticTemplate	cmpp9e303001bskiggu0xn4g0	CREATE	[INTAKE] Undsen	\N	{"name": "Undsen", "type": "INTAKE", "price": "50000", "isActive": false}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:56:36.549
cmpp9fscy001dskigojdfdsiw	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:57:56.05
cmpp9hh2h001eskigqvevdcfx	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 08:59:14.729
cmpp9jj8h001gskigo0i1562q	ServiceOrder	cmpp9jj8b001fskigltmlizc7	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpp3f4zw000d0kiggeq0lcat", "vehicleId": "cmpp97qo0000zskiglwc4hrj5", "customerId": "cmpp97fuu000xskigwzjjipz4", "scheduledAt": "2026-05-28T09:00:00.000Z", "assignedToId": "cmpp3f50i000l0kigcn8nely8"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-28 09:00:50.849
cmpq9kots001iskig1t9m7j7t	Service	cmpq9kotc001hskigtiya49pg	CREATE	[GOODS] Motor oil	\N	{"code": null, "name": "Motor oil", "type": "GOODS", "price": "50000", "stock": "20"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-29 01:49:30.928
cmpq9mpgh001kskig9gb69tyh	DiagnosticTemplate	cmpq9mpgc001jskigm99c72z9	CREATE	[INTAKE] Demo	\N	{"name": "Demo", "type": "INTAKE", "price": null, "isActive": true}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-29 01:51:05.057
cmpq9pl1y001mskigwrse1oje	ServiceOrder	cmpp9jj8b001fskigltmlizc7	ITEM_ADDED	DIAGNOSTIC · Demo × 1 @ 0	\N	{"kind": "DIAGNOSTIC", "total": "0", "itemId": "cmpq9pl1r001lskig0gclg61j", "quantity": "1", "serviceId": null, "unitPrice": "0", "description": "Demo"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-29 01:53:19.318
cmpq9q2xc001nskigv5x3tk1j	DiagnosticTemplate	cmpp9e303001bskiggu0xn4g0	UPDATE	[INTAKE] Undsen	\N	{"name": "Undsen", "type": "INTAKE", "price": "50000", "isActive": true, "schemaChanged": true}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-29 01:53:42.48
cmpq9qakm001pskigs77hzrw8	ServiceOrder	cmpp9jj8b001fskigltmlizc7	ITEM_ADDED	DIAGNOSTIC · Undsen × 1 @ 50000	\N	{"kind": "DIAGNOSTIC", "total": "50000", "itemId": "cmpq9qakk001oskiggnac8m2k", "quantity": "1", "serviceId": null, "unitPrice": "50000", "description": "Undsen"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-29 01:53:52.39
cmpq9qdk2001rskigsrp3tu8e	ServiceOrder	cmpp9jj8b001fskigltmlizc7	ITEM_ADDED	PART · Motor oil × 1 @ 50000	\N	{"kind": "PART", "total": "50000", "itemId": "cmpq9qdjz001qskig2rubag6n", "quantity": "1", "serviceId": "cmpq9kotc001hskigtiya49pg", "unitPrice": "50000", "description": "Motor oil"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-29 01:53:56.258
cmpq9qdkb001sskigvtfgbvwh	Service	cmpq9kotc001hskigtiya49pg	STOCK_CHANGE	-1 (захиалга #cmpp9jj8b001fskigltmlizc7)	\N	{"delta": "-1", "reason": "ORDER_ITEM_ADD"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-29 01:53:56.267
cmpq9qp17001uskigfqqtb97z	ServiceOrder	cmpp9jj8b001fskigltmlizc7	PAYMENT_CHANGE	QPay QR үүсгэв · 100000₮	\N	{"amount": "100000", "paymentId": "cmpq9qowv001tskig9pcyfe5d"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-05-29 01:54:11.131
cmpvzwz4g00006giggq9q0m7v	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 02:05:45.04
cmpw01nf20000kgigyspj62f6	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 02:09:23.15
cmpw27dsf0000rcig0irybv3a	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 03:09:49.84
cmpw2jc8p00007gig5kx55kn6	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 03:19:07.706
cmpw2vd6p00027gig2tx3gzvy	Vehicle	cmpw2vd6k00017gigvupsekga	CREATE	8292УАА · Toyota Corolla Axio	\N	{"vin": "NZE1647026346", "make": "Toyota", "year": 2014, "model": "Corolla Axio", "plate": "8292УАА", "mileage": null, "fuelType": "Бензин", "customerId": "cmpp97fuu000xskigwzjjipz4", "wheelPosition": "Баруун"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 03:28:28.801
cmpw2vzqp00047gigv8qrwba9	Customer	cmpw2vzqm00037gigjvzm2ggo	CREATE	Anar	\N	{"note": null, "email": "anar@a.mn", "phone": "86555442", "fullName": "Anar"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 03:28:58.033
cmpw3xe1z00067gigecttg6dg	Role	cmpp3gago000m0kig24uiqlvj	UPDATE	Засварчин · 20 эрх	{"name": "Засварчин", "isActive": true, "permissions": ["customers.view", "customers.create", "customers.edit", "customers.delete", "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete", "services.view", "services.create", "services.edit", "services.delete", "diagnostics.view", "diagnostics.create", "diagnostics.edit", "diagnostics.delete", "orders.view", "orders.create"]}	{"name": "Засварчин", "isActive": true, "permissions": ["customers.view", "customers.create", "customers.edit", "customers.delete", "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete", "services.view", "services.create", "services.edit", "services.delete", "diagnostics.view", "diagnostics.create", "diagnostics.edit", "diagnostics.delete", "orders.view", "orders.create", "orders.edit", "orders.delete"]}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 03:58:02.855
cmpw3ypyx00077gign4kvp6ze	Role	cmpp3ho1f000o0kigaimf8mnr	UPDATE	Кассчин · 26 эрх	{"name": "Кассчин", "isActive": true, "permissions": ["customers.manage", "vehicles.manage", "services.manage", "diagnostics.manage", "orders.manage", "orders.assignable", "payments.manage", "audit.view"]}	{"name": "Кассчин", "isActive": true, "permissions": ["orders.assignable", "audit.view", "orders.view", "orders.create", "orders.edit", "orders.delete", "diagnostics.view", "diagnostics.create", "diagnostics.edit", "diagnostics.delete", "customers.view", "customers.create", "customers.edit", "customers.delete", "services.view", "services.create", "services.edit", "services.delete", "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete", "payments.view", "payments.create", "payments.edit", "payments.delete"]}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 03:59:04.953
cmpw3yx2e00087gig3tzyejr5	Role	cmpp3gago000m0kig24uiqlvj	UPDATE	Засварчин · 21 эрх	{"name": "Засварчин", "isActive": true, "permissions": ["customers.view", "customers.create", "customers.edit", "customers.delete", "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete", "services.view", "services.create", "services.edit", "services.delete", "diagnostics.view", "diagnostics.create", "diagnostics.edit", "diagnostics.delete", "orders.view", "orders.create", "orders.edit", "orders.delete"]}	{"name": "Засварчин", "isActive": true, "permissions": ["customers.view", "customers.create", "customers.edit", "customers.delete", "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete", "services.view", "services.create", "services.edit", "services.delete", "diagnostics.view", "diagnostics.create", "diagnostics.edit", "diagnostics.delete", "orders.view", "orders.create", "orders.edit", "orders.delete", "orders.assignable"]}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 03:59:14.15
cmpw5hkpr0002nkigp4fw0cqd	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 04:41:44.223
cmpwad38200017wigsdiw6c7h	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-02 06:58:13.01
cmpxdsfus000158igazunf7kp	ServiceOrder	cmpwagqsx00027wigb955jwg8	ITEM_ADDED	DIAGNOSTIC · Demo × 1 @ 0	\N	{"kind": "DIAGNOSTIC", "total": "0", "itemId": "cmpxdsfuc000058igd1lne0fp", "quantity": "1", "serviceId": null, "unitPrice": "0", "description": "Demo"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 01:21:54.244
cmpxdsjgh000358igqceajzlf	ServiceOrder	cmpwagqsx00027wigb955jwg8	ITEM_ADDED	LABOR · Naklad solih × 1 @ 20000	\N	{"kind": "LABOR", "total": "20000", "itemId": "cmpxdsjgd000258ig1j294lm1", "quantity": "1", "serviceId": "cmpp9bc1s0017skigx87sxubm", "unitPrice": "20000", "description": "Naklad solih"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 01:21:58.913
cmpxdslbj000558igql5yzkwo	ServiceOrder	cmpwagqsx00027wigb955jwg8	PAYMENT_CHANGE	QPay QR үүсгэв · 20000₮	\N	{"amount": "20000", "paymentId": "cmpxdskr7000458igczgvsyqk"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 01:22:01.327
cmpyunvh6002kywigqzgfpre9	ServiceOrder	cmpyul7ds002dywigx30lwh7u	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 02:02:00.858
cmpxdsopp000658igqwn80i1a	ServiceOrder	cmpwagqsx00027wigb955jwg8	PAYMENT_CHANGE	UNPAID → PAID (20000)	{"paymentStatus": "UNPAID"}	{"paidAmount": "20000", "paymentStatus": "PAID"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 01:22:05.725
cmpxdss47000758igkddffqmk	ServiceOrder	cmpwagqsx00027wigb955jwg8	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 01:22:10.135
cmpxg1pd1000b58iggau3pyy2	ServiceOrder	cmpwagqsx00027wigb955jwg8	STATUS_CHANGE	IN_PROGRESS → COMPLETED	{"status": "IN_PROGRESS"}	{"status": "COMPLETED"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:05.701
cmpxg1wnj000c58ig8j0r9hdt	ServiceOrder	cmpp9jj8b001fskigltmlizc7	PAYMENT_CHANGE	UNPAID → PAID (100000)	{"paymentStatus": "UNPAID"}	{"paidAmount": "100000", "paymentStatus": "PAID"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:15.151
cmpxg1xyg000d58ig08ofcfqn	ServiceOrder	cmpp9jj8b001fskigltmlizc7	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:16.84
cmpxg1yl3000e58igsnd2d8x3	ServiceOrder	cmpp9jj8b001fskigltmlizc7	STATUS_CHANGE	IN_PROGRESS → COMPLETED	{"status": "IN_PROGRESS"}	{"status": "COMPLETED"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:17.656
cmpxg21r0000f58igzptr1nq6	ServiceOrder	cmpp97sxv0011skigp5jl7f7x	PAYMENT_CHANGE	UNPAID → PAID (70000)	{"paymentStatus": "UNPAID"}	{"paidAmount": "70000", "paymentStatus": "PAID"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:21.757
cmpxg22az000g58ig17v7e0x8	ServiceOrder	cmpp97sxv0011skigp5jl7f7x	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:22.475
cmpxg239l000h58ig5vxvgllw	ServiceOrder	cmpp97sxv0011skigp5jl7f7x	STATUS_CHANGE	IN_PROGRESS → COMPLETED	{"status": "IN_PROGRESS"}	{"status": "COMPLETED"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:23.721
cmpxg2qw0000i58iggg5ah8d9	Vehicle	cmpxf96tw000858ig40s0lvuj	UPDATE	0099УАК · Toyota Land Cruiser	\N	{"vin": null, "make": "Toyota", "year": 2022, "model": "Land Cruiser", "plate": "0099УАК", "mileage": null, "fuelType": null, "customerId": null, "wheelPosition": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:54.336
cmpxg2two000j58igqguv2gvb	Vehicle	cmpxf96tw000858ig40s0lvuj	UPDATE	0099УАК · Toyota Land Cruiser	\N	{"vin": null, "make": "Toyota", "year": 2022, "model": "Land Cruiser", "plate": "0099УАК", "mileage": null, "fuelType": null, "customerId": null, "wheelPosition": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:25:58.248
cmpxg2x11000k58igt2et7aks	Vehicle	cmpxf96tw000858ig40s0lvuj	UPDATE	0099УАК · Toyota Land Cruiser	\N	{"vin": null, "make": "Toyota", "year": 2022, "model": "Land Cruiser", "plate": "0099УАК", "mileage": null, "fuelType": null, "customerId": null, "wheelPosition": "Зүүн"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:26:02.294
cmpxg32xs000l58igj3dfcwzp	Vehicle	cmpxf96tw000858ig40s0lvuj	UPDATE	0099УА · Toyota Land Cruiser	\N	{"vin": null, "make": "Toyota", "year": 2022, "model": "Land Cruiser", "plate": "0099УА", "mileage": null, "fuelType": null, "customerId": null, "wheelPosition": "Зүүн"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:26:09.952
cmpxg3fve000m58ig7qu3as1k	Vehicle	cmpxf96tw000858ig40s0lvuj	UPDATE	0099УАК · Toyota Land Cruiser	\N	{"vin": "JTMABABJ204032788", "make": "Toyota", "year": 2022, "model": "Land Cruiser", "plate": "0099УАК", "mileage": null, "fuelType": "Бензин", "customerId": null, "wheelPosition": "Зүүн"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:26:26.714
cmpxg3mgs000n58ig9vxkbrep	Vehicle	cmpxf96tw000858ig40s0lvuj	UPDATE	0099УАК · Toyota Land Cruiser	\N	{"vin": "JTMABABJ204032788", "make": "Toyota", "year": 2022, "model": "Land Cruiser", "plate": "0099УАК", "mileage": null, "fuelType": "Бензин", "customerId": "cmpw2vzqm00037gigjvzm2ggo", "wheelPosition": "Зүүн"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:26:35.26
cmpxg3rs9000o58igqj6imtb6	Vehicle	cmpxf96tw000858ig40s0lvuj	UPDATE	0099УАК · Toyota Land Cruiser	\N	{"vin": "JTMABABJ204032788", "make": "Toyota", "year": 2022, "model": "Land Cruiser", "plate": "0099УАК", "mileage": null, "fuelType": "Бензин", "customerId": "cmpxf9px0000958iged59vy6g", "wheelPosition": "Зүүн"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 02:26:42.153
cmpxigumo000s58iggj607j4t	Service	cmpxigumh000r58igdxek9vce	CREATE	[LABOR] Базуур	\N	{"code": null, "name": "Базуур", "type": "LABOR", "price": "30000", "stock": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 03:32:51.6
cmpxjppaw000u58igcxosefvn	Customer	cmpxjppah000t58igtxlsn98e	CREATE	99503223	\N	{"note": null, "email": null, "phone": "99503223", "fullName": ""}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 04:07:44.216
cmpxjvjlr000w58igdasqz7a9	Customer	cmpxjvjl9000v58ig69elnijp	CREATE	99385882 (захиалгаас түргэн)	\N	{"note": null, "email": null, "phone": "99385882", "fullName": ""}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 04:12:16.767
cmpxjx6hn000y58igrly3uluu	Vehicle	cmpxjx6hh000x58ig023g2vql	CREATE	1111УАА · Toyota Land Cruiser (захиалгаас түргэн)	\N	{"make": "Toyota", "year": 2024, "model": "Land Cruiser", "plate": "1111УАА", "fuelType": "Бензин", "customerId": "cmpxjvjl9000v58ig69elnijp"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 04:13:33.083
cmpxjxceu001058igp0c224ys	ServiceOrder	cmpxjxceq000z58igtdcg8ps6	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpp3f4zw000d0kiggeq0lcat", "vehicleId": "cmpxjx6hh000x58ig023g2vql", "customerId": "cmpxjvjl9000v58ig69elnijp", "scheduledAt": null, "assignedToId": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 04:13:40.758
cmpxovzc9001d58ig13984jab	Branch	cmpxovzbe001558igh6sqsct4	CREATE	Tovchoo	\N	{"city": "Ulaanbaatar", "name": "Tovchoo", "phone": "85502020", "khoroo": "1", "address": "Ulaanbaat", "district": "Сонгино хайрхан", "latitude": 47.876663, "openTime": "09:01", "closeTime": "18:00", "isPrimary": false, "longitude": 106.606221}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 06:32:35.241
cmpxv8fwx0000ywig5bc21sr8	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-03 09:30:14.29
cmpyt3jo6000nywighgxw5pyc	Role	cmpyt3jnz000mywigopvd713y	CREATE	Ажилчин · 25 эрх	\N	{"name": "Ажилчин", "isActive": true, "permissions": ["customers.view", "customers.create", "customers.edit", "customers.delete", "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete", "services.view", "services.create", "services.edit", "services.delete", "diagnostics.view", "diagnostics.create", "diagnostics.edit", "diagnostics.delete", "orders.view", "orders.create", "orders.edit", "orders.delete", "payments.view", "payments.create", "payments.edit", "payments.delete", "orders.assignable"]}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:18:12.822
cmpyt46vx000pywigfwe25z2t	Role	cmpyt46vs000oywigt4eyowyx	CREATE	Кассяин · 9 эрх	\N	{"name": "Кассяин", "isActive": true, "permissions": ["orders.view", "orders.create", "orders.edit", "orders.delete", "payments.view", "payments.create", "payments.edit", "payments.delete", "orders.assignable"]}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:18:42.909
cmpyt4cor000qywigxww44hz0	Role	cmpyt46vs000oywigt4eyowyx	UPDATE	Кассчин · 9 эрх	{"name": "Кассяин", "isActive": true, "permissions": ["orders.view", "orders.create", "orders.edit", "orders.delete", "payments.view", "payments.create", "payments.edit", "payments.delete", "orders.assignable"]}	{"name": "Кассчин", "isActive": true, "permissions": ["orders.view", "orders.create", "orders.edit", "orders.delete", "payments.view", "payments.create", "payments.edit", "payments.delete", "orders.assignable"]}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:18:50.427
cmpyt4vtx000sywiggrmw8edx	Role	cmpyt4vts000rywig76go3880	CREATE	Менежер · 33 эрх	\N	{"name": "Менежер", "isActive": true, "permissions": ["employees.view", "employees.create", "employees.edit", "employees.delete", "branches.view", "branches.create", "branches.edit", "branches.delete", "customers.view", "customers.create", "customers.edit", "customers.delete", "vehicles.view", "vehicles.create", "vehicles.edit", "vehicles.delete", "services.view", "services.create", "services.edit", "services.delete", "diagnostics.view", "diagnostics.create", "diagnostics.edit", "diagnostics.delete", "orders.view", "orders.create", "orders.edit", "orders.delete", "payments.view", "payments.create", "payments.edit", "payments.delete", "audit.view"]}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:19:15.237
cmpyt5n75000uywigzsn70wvb	Customer	cmpyt5n72000tywig3pfooet5	CREATE	98665523	\N	{"note": null, "email": null, "phone": "98665523", "fullName": ""}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:19:50.705
cmpyt5qzh000vywigo5rl50om	Customer	cmpyt5n72000tywig3pfooet5	UPDATE	98665523	\N	{"note": null, "email": null, "phone": "98665523", "fullName": ""}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:19:55.613
cmpyt612k000xywiga9b3upp3	Vehicle	cmpyt612e000wywigarj4u3f8	CREATE	7548УЕК · Toyota Land Cruiser	\N	{"vin": "JTMHV05J705023106", "make": "Toyota", "year": 2011, "model": "Land Cruiser", "plate": "7548УЕК", "mileage": null, "fuelType": "Дизель", "customerId": "cmpyt5n72000tywig3pfooet5", "wheelPosition": "Зүүн"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:20:08.684
cmpyt63qb000yywig05p7eaqn	Customer	cmpyt5n72000tywig3pfooet5	UPDATE	98665523	\N	{"note": null, "email": null, "phone": "98665523", "fullName": ""}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:20:12.131
cmpyt8ml40010ywignghvjq0h	User	cmpyt8mkw000zywigszc74hc6	CREATE	Мухулай Боорчи · Ажилчин	\N	{"email": "boorchi@a.mn", "roleId": "cmpyt3jnz000mywigopvd713y", "branchId": "cmpyt2dag000dywig1wufz5r1", "lastName": "Мухулай", "firstName": "Боорчи"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:22:09.88
cmpyt9tod0012ywighf9ltku9	User	cmpyt9to40011ywigndf10fj0	CREATE	Сартуул Ангарагмөрөн · Менежер	\N	{"email": "amurun@a.mn", "roleId": "cmpyt4vts000rywig76go3880", "branchId": null, "lastName": "Сартуул", "firstName": "Ангарагмөрөн"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:23:05.725
cmpytam2c0013ywigmb7guvui	Tenant	cmpyt2d9g0002ywigy2javyr9	UPDATE	Үндсэн мэдээлэл шинэчлэв: Боржигон Автосервис	\N	{"name": "Боржигон Автосервис", "email": "bathuleg@contact.mn", "phone1": "88005520", "phone2": "88005521", "registerNumber": "1234567"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:23:42.516
cmpytbgs1001cywigbtpbwk1n	Branch	cmpytbgrp0014ywigy6zb3nio	CREATE	БурханХалдун	\N	{"city": null, "name": "БурханХалдун", "phone": "70005000", "khoroo": null, "address": null, "district": null, "latitude": null, "openTime": null, "closeTime": null, "isPrimary": false, "longitude": null}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:24:22.321
cmpytc0c1001kywig79o2nfdm	Branch	cmpyt2dag000dywig1wufz5r1	UPDATE	Хааны өргөө	\N	{"city": null, "name": "Хааны өргөө", "phone": "88005520", "khoroo": null, "address": null, "district": null, "latitude": null, "openTime": null, "closeTime": null, "isPrimary": true, "longitude": null}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:24:47.665
cmpytc8we001sywig4fdsxqpz	Branch	cmpytbgrp0014ywigy6zb3nio	UPDATE	Бурханхалдун	\N	{"city": null, "name": "Бурханхалдун", "phone": "70005000", "khoroo": null, "address": null, "district": null, "latitude": null, "openTime": null, "closeTime": null, "isPrimary": false, "longitude": null}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:24:58.766
cmpytcl9m0021ywigo1iy5tcd	Branch	cmpytcl99001tywige6itdj46	CREATE	Ононмөрөн	\N	{"city": null, "name": "Ононмөрөн", "phone": null, "khoroo": null, "address": null, "district": null, "latitude": null, "openTime": null, "closeTime": null, "isPrimary": false, "longitude": null}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:25:14.794
cmpytczmo002aywigdf4zfsuz	Branch	cmpytczmf0022ywigp3qzt220	CREATE	Бээжин	\N	{"city": null, "name": "Бээжин", "phone": null, "khoroo": null, "address": null, "district": null, "latitude": null, "openTime": null, "closeTime": null, "isPrimary": false, "longitude": null}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:25:33.408
cmpyuk93g002cywig6yb70gki	DiagnosticTemplate	cmpyuk939002bywigh1uqdvzz	CREATE	[INTAKE] jiriin	\N	{"name": "jiriin", "type": "INTAKE", "price": "15000", "isActive": true}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:59:11.884
cmpyul7dy002eywige6x1go4l	ServiceOrder	cmpyul7ds002dywigx30lwh7u	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpytcl99001tywige6itdj46", "vehicleId": "cmpyt612e000wywigarj4u3f8", "customerId": "cmpyt5n72000tywig3pfooet5", "scheduledAt": null, "assignedToId": "cmpyt8mkw000zywigszc74hc6"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 01:59:56.326
cmpyulfe2002gywig055zqo49	ServiceOrder	cmpyul7ds002dywigx30lwh7u	ITEM_ADDED	DIAGNOSTIC · jiriin × 1 @ 15000	\N	{"kind": "DIAGNOSTIC", "total": "15000", "itemId": "cmpyulfdz002fywigf2k7ngzg", "quantity": "1", "serviceId": null, "unitPrice": "15000", "description": "jiriin"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 02:00:06.699
cmpyume6h002iywigmyrux369	DiagnosticReport	cmpyume6a002hywigxxlcec51	CREATE	jiriin · захиалга #cmpyul7ds002dywigx30lwh7u	\N	{"orderId": "cmpyul7ds002dywigx30lwh7u", "branchId": "cmpytcl99001tywige6itdj46", "vehicleId": "cmpyt612e000wywigarj4u3f8", "customerId": "cmpyt5n72000tywig3pfooet5", "templateId": "cmpyuk939002bywigh1uqdvzz"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 02:00:51.785
cmpyunse5002jywig4ikh76r5	ServiceOrder	cmpyul7ds002dywigx30lwh7u	PAYMENT_CHANGE	UNPAID → PAID (15000)	{"paymentStatus": "UNPAID"}	{"paidAmount": "15000", "paymentStatus": "PAID"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 02:01:56.861
cmpyunx1c002lywig6lcbsj81	ServiceOrder	cmpyul7ds002dywigx30lwh7u	STATUS_CHANGE	IN_PROGRESS → WAITING_PARTS	{"status": "IN_PROGRESS"}	{"status": "WAITING_PARTS"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 02:02:02.88
cmpyunzqx002mywigiv08qtia	ServiceOrder	cmpyul7ds002dywigx30lwh7u	STATUS_CHANGE	WAITING_PARTS → IN_PROGRESS	{"status": "WAITING_PARTS"}	{"status": "IN_PROGRESS"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 02:02:06.393
cmpyut7m6002oywigxkgrctp1	LaborCategory	cmpyut7lz002nywig0e8lxyoj	CREATE	Demo	\N	{"name": "Demo", "isActive": true, "description": null}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 02:06:09.87
cmpyvobdq002rywigzsjdu7o1	User	cmpyt2dap000lywigv9rpp34j	LOGOUT	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-04 02:30:21.086
cmpyvof0u002sywight0dquqt	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 02:30:25.806
cmpyzptut002tywigz61piu6i	DiagnosticTemplate	cmpq9mpgc001jskigm99c72z9	UPDATE	[INTAKE] Demo · v2	\N	{"name": "Demo", "type": "INTAKE", "price": null, "isActive": true, "schemaChanged": true}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 04:23:30.149
cmpz50f630000y4ig37a6cw5k	User	cmpp65q9z0002wkiggzquyx9n	UPDATE	Naimanjin Myagmardorj · Засварчин	{"email": "act@a.mn", "roleId": "cmpp3gago000m0kig24uiqlvj", "branchId": "cmpp3f4zw000d0kiggeq0lcat", "lastName": "Naimanjin", "firstName": "Myagmardorj"}	{"email": "act@a.mn", "roleId": "cmpp3gago000m0kig24uiqlvj", "branchId": "cmpxovzbe001558igh6sqsct4", "lastName": "Naimanjin", "firstName": "Myagmardorj"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 06:51:42.415
cmpz5po400001y4ig8t549meg	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:11:20.4
cmpz5prb70002y4ig44z3vjkc	User	cmpp65q9z0002wkiggzquyx9n	LOGIN	act@a.mn	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-04 07:11:24.547
cmpz5q8zj0003y4igi649kxo5	User	cmpp65q9z0002wkiggzquyx9n	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-04 07:11:47.455
cmpz5qclb0004y4igikghkqzd	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:11:52.127
cmpz5wj140005y4igotyzfjke	ServiceOrder	cmpxjxceq000z58igtdcg8ps6	UPDATE	Захиалгын мэдээлэл шинэчлэв	\N	{"branchId": "cmpxovzbe001558igh6sqsct4", "vehicleId": "cmpxjx6hh000x58ig023g2vql", "customerId": "cmpxjvjl9000v58ig69elnijp", "scheduledAt": null, "assignedToId": "cmpp65q9z0002wkiggzquyx9n"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:16:40.408
cmpz5xjj80007y4iggnktu850	ServiceOrder	cmpw4qs3x0000nkigki73wi39	ITEM_ADDED	DIAGNOSTIC · Undsen × 1 @ 50000	\N	{"kind": "DIAGNOSTIC", "total": "50000", "itemId": "cmpz5xjj40006y4igpdk3zt9b", "quantity": "1", "serviceId": null, "unitPrice": "50000", "description": "Undsen"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:17:27.716
cmpz5xogv0009y4igbbhej378	ServiceOrder	cmpw4qs3x0000nkigki73wi39	ITEM_ADDED	LABOR · Базуур × 1 @ 30000	\N	{"kind": "LABOR", "total": "30000", "itemId": "cmpz5xogs0008y4igvdahdrg3", "quantity": "1", "serviceId": "cmpxigumh000r58igdxek9vce", "unitPrice": "30000", "description": "Базуур"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:17:34.111
cmpz5ya97000ay4igdpnumohw	ServiceOrder	cmpw4qs3x0000nkigki73wi39	UPDATE	Захиалгын мэдээлэл шинэчлэв	\N	{"branchId": "cmpp3f4zw000d0kiggeq0lcat", "vehicleId": "cmpxjx6hh000x58ig023g2vql", "customerId": "cmpxjvjl9000v58ig69elnijp", "scheduledAt": "2026-06-26T01:00:00.000Z", "assignedToId": "cmpp65q9z0002wkiggzquyx9n"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:18:02.347
cmpz6d6qm000by4igio2k0cz9	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:29:37.63
cmpz6d9i8000cy4igfy8v9fqe	User	cmpp65q9z0002wkiggzquyx9n	LOGIN	act@a.mn	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-04 07:29:41.216
cmpz6e4m4000dy4ig8k4lb823	User	cmpp65q9z0002wkiggzquyx9n	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-04 07:30:21.532
cmpz6e85j000ey4igo3q598qm	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:30:26.119
cmpz6i5yn000fy4igr5nwj888	ServiceOrder	cmpxjxceq000z58igtdcg8ps6	STATUS_CHANGE	SCHEDULED → CANCELLED	{"status": "SCHEDULED"}	{"status": "CANCELLED"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:33:29.903
cmpz7daeo0001p4igtpaq0j0b	ServiceOrder	cmpw4qs3x0000nkigki73wi39	ITEM_ADDED	DIAGNOSTIC · Undsen × 1 @ 50000	\N	{"kind": "DIAGNOSTIC", "total": "50000", "itemId": "cmpz7daec0000p4igezmw9us0", "quantity": "1", "serviceId": null, "unitPrice": "50000", "description": "Undsen"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:57:42.001
cmpz7ddeh0002p4igzr7fvuy9	ServiceOrder	cmpw4qs3x0000nkigki73wi39	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 07:57:45.882
cmpz7i2660003p4igy6fe8tpc	ServiceOrder	cmpw4qs3x0000nkigki73wi39	STATUS_CHANGE	IN_PROGRESS → WAITING_PARTS	{"status": "IN_PROGRESS"}	{"status": "WAITING_PARTS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:01:24.606
cmpz7i3wh0004p4ig08p62w6k	ServiceOrder	cmpw4qs3x0000nkigki73wi39	STATUS_CHANGE	WAITING_PARTS → IN_PROGRESS	{"status": "WAITING_PARTS"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:01:26.85
cmpz7iaug0006p4igwdplpexh	ServiceOrder	cmpw4qs3x0000nkigki73wi39	ITEM_ADDED	DIAGNOSTIC · Undsen × 1 @ 50000	\N	{"kind": "DIAGNOSTIC", "total": "50000", "itemId": "cmpz7iaud0005p4ig13di9twn", "quantity": "1", "serviceId": null, "unitPrice": "50000", "description": "Undsen"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:01:35.848
cmpz7ied20007p4igh7opyxpz	ServiceOrder	cmpw4qs3x0000nkigki73wi39	STATUS_CHANGE	IN_PROGRESS → WAITING_PARTS	{"status": "IN_PROGRESS"}	{"status": "WAITING_PARTS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:01:40.406
cmpz7if5y0008p4igxncf892y	ServiceOrder	cmpw4qs3x0000nkigki73wi39	STATUS_CHANGE	WAITING_PARTS → IN_PROGRESS	{"status": "WAITING_PARTS"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:01:41.446
cmpz7ihs30009p4ig8fzu7upd	ServiceOrder	cmpw4qs3x0000nkigki73wi39	ITEM_REMOVED	removed item cmpz7daec0000p4igezmw9us0	{"itemId": "cmpz7daec0000p4igezmw9us0", "quantity": "1", "serviceId": null}	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:01:44.835
cmpz7iibb000ap4igf4rc7tgl	ServiceOrder	cmpw4qs3x0000nkigki73wi39	ITEM_REMOVED	removed item cmpz7iaud0005p4ig13di9twn	{"itemId": "cmpz7iaud0005p4ig13di9twn", "quantity": "1", "serviceId": null}	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:01:45.527
cmpz7in43000bp4ig29v35vqe	ServiceOrder	cmpw4qs3x0000nkigki73wi39	DELETE	#00003	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:01:51.747
cmpz7nyuf000ip4igpwwdjvb5	ServiceOrder	cmpz7nytd000fp4igtihkpv2x	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpxovzbe001558igh6sqsct4", "vehicleId": "cmpxjx6hh000x58ig023g2vql", "customerId": "cmpxjvjl9000v58ig69elnijp", "scheduledAt": "2026-06-04T01:00:00.000Z", "assignedToId": "cmpp65q9z0002wkiggzquyx9n"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:06:00.231
cmpz7o5rg000jp4igoisb78sz	ServiceOrder	cmpz7nytd000fp4igtihkpv2x	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:06:09.196
cmpz7swlj000kp4ig7w4vn0aq	ServiceOrder	cmpxjxceq000z58igtdcg8ps6	DELETE	#00006	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:09:50.599
cmpz7t9nb000mp4igfxnj407y	ServiceOrder	cmpz7nytd000fp4igtihkpv2x	ITEM_ADDED	DIAGNOSTIC · Undsen × 1 @ 50000	\N	{"kind": "DIAGNOSTIC", "total": "50000", "itemId": "cmpz7t9n8000lp4igierx4m8p", "quantity": "1", "serviceId": null, "unitPrice": "50000", "description": "Undsen"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:10:07.511
cmpz7znsz000op4ig3xxxaves	ServiceOrder	cmpz7nytd000fp4igtihkpv2x	ITEM_ADDED	LABOR · Базуур × 1 @ 30000	\N	{"kind": "LABOR", "total": "30000", "itemId": "cmpz7znsj000np4igt5cybqsa", "quantity": "1", "serviceId": "cmpxigumh000r58igdxek9vce", "unitPrice": "30000", "description": "Базуур"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:15:05.795
cmpz8cvpa000pp4igzj5ink3g	ServiceOrder	cmpz7nytd000fp4igtihkpv2x	STATUS_CHANGE	IN_PROGRESS → CANCELLED	{"status": "IN_PROGRESS"}	{"status": "CANCELLED"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:25:22.559
cmpz8dz84000qp4ig93z4pyq8	ServiceOrder	cmpyvnlkf002qywigvd5anb4e	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:26:13.78
cmpz8et4d000sp4ig5jge637g	ServiceOrder	cmpxl6vqf001458ignrf46o7s	ITEM_ADDED	LABOR · Тос солих × 1 @ 50000	\N	{"kind": "LABOR", "total": "50000", "itemId": "cmpz8et48000rp4igterbt9el", "quantity": "1", "serviceId": "cmpp91xdt000eskigq5vadzir", "unitPrice": "50000", "description": "Тос солих"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:26:52.525
cmpz8ewie000tp4igc1pbk4ke	ServiceOrder	cmpxl6vqf001458ignrf46o7s	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:26:56.918
cmpz8gpx0000vp4igoe2199l5	Vehicle	cmpz8gpwt000up4igg19yww7z	CREATE	1234УНЦ · BYD QCJ2030ST6HEV1 (захиалгаас түргэн)	\N	{"make": "BYD", "year": 2024, "model": "QCJ2030ST6HEV1", "plate": "1234УНЦ", "fuelType": "Бензин - Цахилгаан", "customerId": "cmpxjppah000t58igtxlsn98e"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:28:21.684
cmpz8gsy5000zp4ig85paper1	ServiceOrder	cmpz8gsxp000wp4iginmtpi46	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpp3f4zw000d0kiggeq0lcat", "vehicleId": "cmpz8gpwt000up4igg19yww7z", "customerId": "cmpxjppah000t58igtxlsn98e", "scheduledAt": "2026-07-11T02:00:00.000Z", "assignedToId": "cmpp3f50i000l0kigcn8nely8"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:28:25.613
cmpz8gv050010p4igh0as7j19	ServiceOrder	cmpz8gsxp000wp4iginmtpi46	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:28:28.277
cmpz9il570014p4igjms7dbmv	ServiceOrder	cmpz8gsxp000wp4iginmtpi46	ITEM_ADDED	PART · Motor oil × 1 @ 50000	\N	{"kind": "PART", "total": "50000", "itemId": "cmpz9il4v0013p4ig287mubqe", "quantity": "1", "serviceId": "cmpq9kotc001hskigtiya49pg", "unitPrice": "50000", "description": "Motor oil"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:57:48.427
cmpz9il5o0015p4igwdz17dwx	Service	cmpq9kotc001hskigtiya49pg	STOCK_CHANGE	-1 (захиалга #cmpz8gsxp000wp4iginmtpi46)	\N	{"delta": "-1", "reason": "ORDER_ITEM_ADD"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:57:48.444
cmpz9iq4r0017p4ig4j6lbqko	ServiceOrder	cmpz8gsxp000wp4iginmtpi46	ITEM_ADDED	DIAGNOSTIC · Demo × 1 @ 0	\N	{"kind": "DIAGNOSTIC", "total": "0", "itemId": "cmpz9iq4o0016p4igbhgjl1zu", "quantity": "1", "serviceId": null, "unitPrice": "0", "description": "Demo"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 08:57:54.891
cmpza745z0019p4igcpcle6lj	ServiceOrder	cmpz8gsxp000wp4iginmtpi46	ITEM_ADDED	PART · Motor oil × 1 @ 50000	\N	{"kind": "PART", "total": "50000", "itemId": "cmpza745p0018p4igz88qn0gj", "quantity": "1", "serviceId": "cmpq9kotc001hskigtiya49pg", "unitPrice": "50000", "description": "Motor oil"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 09:16:52.823
cmpza746a001ap4igqmrpfzel	Service	cmpq9kotc001hskigtiya49pg	STOCK_CHANGE	-1 (захиалга #cmpz8gsxp000wp4iginmtpi46)	\N	{"delta": "-1", "reason": "ORDER_ITEM_ADD"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 09:16:52.834
cmpza75zi001bp4igug1mwgr4	ServiceOrder	cmpz8gsxp000wp4iginmtpi46	ITEM_REMOVED	removed item cmpza745p0018p4igz88qn0gj	{"itemId": "cmpza745p0018p4igz88qn0gj", "quantity": "1", "serviceId": "cmpq9kotc001hskigtiya49pg"}	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 09:16:55.183
cmpza75zt001cp4igvzdd5tb4	Service	cmpq9kotc001hskigtiya49pg	STOCK_CHANGE	+1 (мөр устгасан)	\N	{"delta": "+1", "reason": "ORDER_ITEM_REMOVE"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 09:16:55.193
cmpza79iw001ep4igstltzdxy	ServiceOrder	cmpz8gsxp000wp4iginmtpi46	ITEM_ADDED	LABOR · Naklad solih × 1 @ 20000	\N	{"kind": "LABOR", "total": "20000", "itemId": "cmpza79iu001dp4igf95w9iwu", "quantity": "1", "serviceId": "cmpp9bc1s0017skigx87sxubm", "unitPrice": "20000", "description": "Naklad solih"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-04 09:16:59.768
cmq0asalv000p2oigdk530713	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 02:21:07.124
cmq0b7qxl000q2oig9fqz3p9h	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 02:33:08.121
cmq0c86ox000r2oig5ecz6w3n	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 03:01:28.162
cmq0f7sma000s2oigm55f9ybi	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 04:25:08.77
cmq0g0b9h00010wigkrbdbdk0	Appointment	cmq0g0b8t00000wigh3lsmi96	CREATE	Утсаар цаг бүртгэсэн	\N	{"status": "CONFIRMED", "customerId": "cmpw2vzqm00037gigjvzm2ggo", "requestedAt": "2026-06-05T01:00:00.000Z"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	cmpp3f4zw000d0kiggeq0lcat	\N	\N	2026-06-05 04:47:19.301
cmq0g7lw800030wigwf05up7e	Appointment	cmq0g7lvt00020wig3tzpy3dz	CREATE	Утсаар цаг бүртгэсэн	\N	{"status": "CONFIRMED", "customerId": "cmpxf9px0000958iged59vy6g", "requestedAt": "2026-06-08T01:00:00.000Z"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	cmpxovzbe001558igh6sqsct4	\N	\N	2026-06-05 04:52:59.672
cmq0is6jt0000qcig9u8fr19u	Tenant	cmpp3f4zb00020kigzdmly5ii	UPDATE	Үндсэн мэдээлэл шинэчлэв: Инфосистемс	\N	{"name": "Инфосистемс", "email": "contact@info.mn", "phone1": "70116543", "phone2": null, "registerNumber": "2565439", "acceptsOnlineBooking": true}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 06:04:58.793
cmq0itkwe0002qcigirkyg5i2	Appointment	cmq0itb5q0001qcign2yfcxyx	STATUS_CHANGE	Цаг баталгаажуулсан	\N	{"status": "CONFIRMED", "customerId": "cmpp97fuu000xskigwzjjipz4"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	cmpp3f4zw000d0kiggeq0lcat	\N	\N	2026-06-05 06:06:04.047
cmq0iueoq000aqcigtnbdhcup	Branch	cmpp3f4zw000d0kiggeq0lcat	UPDATE	Үндсэн салбар	\N	{"city": null, "name": "Үндсэн салбар", "phone": "70116543", "khoroo": null, "address": null, "district": null, "latitude": 47.921735, "openTime": null, "closeTime": null, "isPrimary": true, "longitude": 106.901135}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 06:06:42.65
cmq0lvr6d0006i0ig9e541a20	Tenant	cmpp3f4zb00020kigzdmly5ii	UPDATE	Үндсэн мэдээлэл шинэчлэв: Инфосистемс	\N	{"name": "Инфосистемс", "email": "contact@info.mn", "phone1": "70116543", "phone2": null, "registerNumber": "2565439", "acceptsOnlineBooking": true}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 07:31:44.342
cmq0mh4l30007i0igrgnd7g11	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 07:48:21.495
cmq0mmqpl0008i0igrif2rul8	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 07:52:43.449
cmq0pjkd60008wgiga766uo99	Branch	cmpp3f4zw000d0kiggeq0lcat	UPDATE	Үндсэн салбар	\N	{"city": null, "name": "Үндсэн салбар", "phone": "70116543", "khoroo": null, "address": null, "district": null, "latitude": 47.921735, "openTime": "11:00", "closeTime": "20:00", "isPrimary": true, "longitude": 106.901135, "slotMinutes": null, "slotCapacity": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 09:14:14.106
cmq0pk1rh000gwgigq8ogkbje	Branch	cmpxovzbe001558igh6sqsct4	UPDATE	Tovchoo	\N	{"city": "Ulaanbaatar", "name": "Tovchoo", "phone": "85502020", "khoroo": "1", "address": "Ulaanbaat", "district": "Сонгино хайрхан", "latitude": 47.876663, "openTime": "09:00", "closeTime": "18:00", "isPrimary": false, "longitude": 106.606221, "slotMinutes": null, "slotCapacity": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 09:14:36.653
cmq0pl0zk000pwgigfynbdb9v	Branch	cmpp3f4zw000d0kiggeq0lcat	UPDATE	Үндсэн салбар	\N	{"city": null, "name": "Үндсэн салбар", "phone": "70116543", "khoroo": null, "address": null, "district": null, "latitude": 47.921735, "openTime": "11:00", "closeTime": "20:00", "isPrimary": true, "longitude": 106.901135, "slotMinutes": null, "slotCapacity": null}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 09:15:22.304
cmq0pl9uv000xwgigrlxfi04z	Branch	cmpp3f4zw000d0kiggeq0lcat	UPDATE	Үндсэн салбар	\N	{"city": null, "name": "Үндсэн салбар", "phone": "70116543", "khoroo": null, "address": null, "district": null, "latitude": 47.921735, "openTime": "11:00", "closeTime": "20:00", "isPrimary": true, "longitude": 106.901135, "slotMinutes": null, "slotCapacity": 2}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 09:15:33.799
cmq0qtzr90015wgigyx99jjk6	Branch	cmpp3f4zw000d0kiggeq0lcat	UPDATE	Үндсэн салбар	\N	{"city": null, "name": "Үндсэн салбар", "phone": "70116543", "khoroo": null, "address": null, "district": null, "latitude": 47.921735, "openTime": "11:00", "closeTime": "20:00", "isPrimary": true, "longitude": 106.901135, "slotMinutes": null, "slotCapacity": 1}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 09:50:20.229
cmq0vtnli0018wgigpncma6bp	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 12:10:02.55
cmq0w9rsj001awgighzdf1byp	Vehicle	cmq0w9rse0019wgigxs5dm7rb	CREATE	0839ХӨН · Toyota Land Cruiser Prado	\N	{"vin": "TRJ1500047911", "make": "Toyota", "year": 2014, "model": "Land Cruiser Prado", "plate": "0839ХӨН", "mileage": null, "fuelType": "Бензин", "customerId": null, "wheelPosition": "Баруун"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 12:22:34.483
cmq0wg08i001bwgigefkaa6gq	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 12:27:25.362
cmq0whw8a001cwgigk12mnwun	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-05 12:28:53.482
cmq4kgh0e0000ukig6ytj96fp	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 02:02:56.415
cmq4kgjn60002ukig3tw9r3z8	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 02:02:59.826
cmq4m2l2t0000j0igcdsc9t68	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 02:48:07.733
cmq4m2o5d0002j0igbxhtk1ge	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 02:48:11.713
cmq4mwh1e0002swig7p3k7y51	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpxovzbe001558igh6sqsct4", "vehicleId": "cmpzayfo0001jp4ig58jsxlnd", "customerId": "cmpzaydyr001ip4ig626t8g5w", "scheduledAt": "2026-06-12T06:00:00.000Z", "assignedToId": "cmpp65q9z0002wkiggzquyx9n"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 03:11:22.178
cmq4mwsa70004swigj8ozvyu3	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	ITEM_ADDED	LABOR · Naklad solih × 1 @ 20000	\N	{"kind": "LABOR", "total": "20000", "itemId": "cmq4mwsa00003swiga5775nst", "quantity": "1", "serviceId": "cmpp9bc1s0017skigx87sxubm", "unitPrice": "20000", "description": "Naklad solih"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 03:11:36.751
cmq4mx0ks0006swiguf3jck99	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	ITEM_ADDED	DIAGNOSTIC · Demo × 1 @ 0	\N	{"kind": "DIAGNOSTIC", "total": "0", "itemId": "cmq4mx0kj0005swigrjq82nvo", "quantity": "1", "serviceId": null, "unitPrice": "0", "description": "Demo"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 03:11:47.5
cmq4mx87q0008swigj6744meg	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	ITEM_ADDED	PART · Motor oil × 1 @ 50000	\N	{"kind": "PART", "total": "50000", "itemId": "cmq4mx87m0007swigcnvud7p0", "quantity": "1", "serviceId": "cmpq9kotc001hskigtiya49pg", "unitPrice": "50000", "description": "Motor oil"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 03:11:57.398
cmq4mx87x0009swig1lq9ml72	Service	cmpq9kotc001hskigtiya49pg	STOCK_CHANGE	-1 (захиалга #cmq4mwh0j0000swig6qpfa2k8)	\N	{"delta": "-1", "reason": "ORDER_ITEM_ADD"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 03:11:57.405
cmq4mxaoq000aswigk08pamhb	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 03:12:00.602
cmq4mxf3w000bswigqzq2l5yo	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	ITEM_REMOVED	removed item cmq4mx0kj0005swigrjq82nvo	{"itemId": "cmq4mx0kj0005swigrjq82nvo", "quantity": "1", "serviceId": null}	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 03:12:06.332
cmq4n2c8m000cswigsu5x0quj	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	STATUS_CHANGE	IN_PROGRESS → WAITING_PARTS	{"status": "IN_PROGRESS"}	{"status": "WAITING_PARTS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 03:15:55.894
cmq4t2tv60000p0igoukh2sts	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 06:04:16.434
cmq4vkqcz00010wig8cjetz9u	User	cmpyt2dap000lywigv9rpp34j	LOGIN	uguudei@a.mn	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-08 07:14:10.931
cmq4wj0on0001n8ig4ibuhx5l	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 07:40:50.615
cmq4wkc0r0002n8igoq6ntsdr	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-08 07:41:51.963
cmq4wy9tp0004n8ig8mzpkdr2	User	cmpp65q9z0002wkiggzquyx9n	LOGIN	act@a.mn	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-08 07:52:42.301
cmq4x5cq00006n8igg8dconca	Service	cmq4x5cpp0005n8igufebwab8	CREATE	[GOODS] MK Oil	\N	{"code": null, "name": "MK Oil", "type": "GOODS", "price": "90000", "stock": "0"}	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-08 07:58:12.648
cmq4x5oul0007n8igvv8zuuey	Service	cmq4x5cpp0005n8igufebwab8	STOCK_CHANGE	+50 (гар тохируулга)	{"stock": "0"}	{"stock": "50", "reason": "MANUAL_ADJUST"}	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-08 07:58:28.365
cmq4x5qfo0008n8ig0rdh9ij0	Service	cmq4x5cpp0005n8igufebwab8	UPDATE	[GOODS] MK Oil	\N	{"code": null, "name": "MK Oil", "price": "90000", "isActive": true}	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-08 07:58:30.42
cmq5zc41d0000z8ig5ujt07sb	User	cmpp65q9z0002wkiggzquyx9n	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-09 01:47:13.393
cmq5zc6y50002z8igd6b3ch5r	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-09 01:47:17.165
cmq61ujkg0000zciggg6v8cot	User	cmpyt2dap000lywigv9rpp34j	LOGOUT	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-09 02:57:32.56
cmq6ecurm00015cigdgut10e8	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-09 08:47:42.274
cmq7dxkev0001sciglm0w7yok	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-10 01:23:35.191
cmq7i54p90004scig2zr9rcxe	Appointment	cmq0qv4as0016wgigpuz6d62h	STATUS_CHANGE	Цаг баталгаажуулсан (мобайл)	\N	{"status": "CONFIRMED", "vehicleId": null, "customerId": "cmpp97fuu000xskigwzjjipz4"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	cmpp3f4zw000d0kiggeq0lcat	\N	\N	2026-06-10 03:21:26.541
cmq7i5ui90007scigropmynkv	User	cmpyt2dap000lywigv9rpp34j	LOGIN	uguudei@a.mn	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-10 03:21:59.986
cmq7oomwm0009scig3sb59bis	User	cmpyt2dap000lywigv9rpp34j	LOGOUT	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-10 06:24:34.294
cmq7oqw3e000270igf4py472p	User	cmpp65q9z0002wkiggzquyx9n	LOGIN	act@a.mn	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-10 06:26:19.514
cmq7or53h000370igp0bkxknq	User	cmpp65q9z0002wkiggzquyx9n	UPDATE	Профайл шинэчлэв	\N	{"email": "act@a.mn", "phone": "99915431", "lastName": "Naimanjin", "firstName": "Myagmardorj"}	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-10 06:26:31.181
cmq7qpt9u0000lgig5y3k4kzl	User	cmpp65q9z0002wkiggzquyx9n	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-10 07:21:28.434
cmq7qt3j90002lgigoa5l4s5y	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-10 07:24:01.701
cmq7ralsp0003lgigi03n1fkt	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-10 07:37:38.521
cmq7razrz0005lgig0b9qstbh	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-10 07:37:56.639
cmq7rcfhi0007lgigw5q8v3rt	User	cmq7rcfh90006lgigsifmc02v	CREATE	Erhembayr Enhjin · Кассчин	\N	{"email": "enhjino@gmail.com", "roleId": "cmpp3ho1f000o0kigaimf8mnr", "branchId": "cmpp3f4zw000d0kiggeq0lcat", "lastName": "Erhembayr", "firstName": "Enhjin"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-10 07:39:03.654
cmq7sf7y00000mgig9t9ee4hm	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-10 08:09:13.464
cmq7sgbhq0003mgigfxq2wp4o	User	cmq7rcfh90006lgigsifmc02v	LOGIN	enhjino@gmail.com · аккаунт идэвхжүүлэв	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmq7rcfh90006lgigsifmc02v	\N	\N	\N	2026-06-10 08:10:04.718
cmq7txu6z0005mgigtrkycp4q	User	cmpyt2dap000lywigv9rpp34j	LOGIN	uguudei@a.mn	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-10 08:51:41.723
cmq7tyuix0007mgigqa6tu1ss	User	cmq7tyuij0006mgigvces5iyb	CREATE	Бар Бамбар · Менежер	\N	{"email": "bambar@gmail.com", "roleId": "cmpyt4vts000rywig76go3880", "branchId": "cmpytbgrp0014ywigy6zb3nio", "lastName": "Бар", "firstName": "Бамбар"}	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	\N	\N	\N	2026-06-10 08:52:28.809
cmq7tzupw0009mgigmgfoe9u0	User	cmq7tyuij0006mgigvces5iyb	LOGIN	bambar@gmail.com · аккаунт идэвхжүүлэв (mobile)	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmq7tyuij0006mgigvces5iyb	\N	\N	\N	2026-06-10 08:53:15.716
cmq8utqli000emgigqi2i1bwg	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 02:04:16.23
cmq8x6jrl0002hsigzrbkobs3	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 03:10:13.137
cmq90xruk000ghsig8cd5oiqz	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 04:55:22.173
cmq9692ea000jhsigmr4cn11p	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 07:24:07.138
cmq969ta8000lhsigesk42ysv	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 07:24:41.984
cmq96s3jw0001a0igguaob464	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	PAYMENT_CHANGE	QPay QR үүсгэв · 70000₮	\N	{"amount": "70000", "paymentId": "cmq96s34m0000a0ig5cek4aza"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 07:38:55.1
cmq96ua8x0003a0ignaiis3kk	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	PAYMENT_CHANGE	QPay QR үүсгэв · 70000₮	\N	{"amount": "70000", "paymentId": "cmq96ua120002a0igoog5sm9e"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 07:40:37.089
cmq9m1l110001tsigg7bdcjvm	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:46:11.893
cmq9m82te0004tsig6bauseyg	ServiceOrder	cmq9m82sm0002tsigwfsv89bu	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpxovzbe001558igh6sqsct4", "vehicleId": "cmpzayfo0001jp4ig58jsxlnd", "customerId": "cmpzaydyr001ip4ig626t8g5w", "scheduledAt": "2026-06-11T01:00:00.000Z", "assignedToId": "cmq7rcfh90006lgigsifmc02v"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:51:14.882
cmq9m8vb00006tsig5v0p4vp3	ServiceOrder	cmq9m82sm0002tsigwfsv89bu	ITEM_ADDED	LABOR · Тос солих × 1 @ 50000	\N	{"kind": "LABOR", "total": "50000", "itemId": "cmq9m8vau0005tsigbgq98zri", "quantity": "1", "serviceId": "cmpp91xdt000eskigq5vadzir", "unitPrice": "50000", "description": "Тос солих"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:51:51.804
cmq9m9azz0008tsig6mbmcqch	ServiceOrder	cmq9m82sm0002tsigwfsv89bu	ITEM_ADDED	PART · MK Oil × 1 @ 90000	\N	{"kind": "PART", "total": "90000", "itemId": "cmq9m9azv0007tsigomkc4zq1", "quantity": "1", "serviceId": "cmq4x5cpp0005n8igufebwab8", "unitPrice": "90000", "description": "MK Oil"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:52:12.143
cmq9m9b0b0009tsig16ghdpi3	Service	cmq4x5cpp0005n8igufebwab8	STOCK_CHANGE	-1 (захиалга #cmq9m82sm0002tsigwfsv89bu)	\N	{"delta": "-1", "reason": "ORDER_ITEM_ADD"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:52:12.155
cmq9m9q87000atsigcm9vqg6y	ServiceOrder	cmq9m82sm0002tsigwfsv89bu	ITEM_REMOVED	removed item cmq9m9azv0007tsigomkc4zq1	{"itemId": "cmq9m9azv0007tsigomkc4zq1", "quantity": "1", "serviceId": "cmq4x5cpp0005n8igufebwab8"}	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:52:31.879
cmq9m9q8i000btsigbloilf64	Service	cmq4x5cpp0005n8igufebwab8	STOCK_CHANGE	+1 (мөр устгасан)	\N	{"delta": "+1", "reason": "ORDER_ITEM_REMOVE"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:52:31.89
cmq9ma77e000ctsiglro1ejwl	ServiceOrder	cmq9m82sm0002tsigwfsv89bu	STATUS_CHANGE	SCHEDULED → IN_PROGRESS	{"status": "SCHEDULED"}	{"status": "IN_PROGRESS"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:52:53.882
cmq9mfse3000etsigejpgvqeh	DiagnosticTemplate	cmq9mfsdw000dtsigm5rhn2rs	CREATE	[INTAKE] ijijj	\N	{"name": "ijijj", "type": "INTAKE", "price": "250000", "isActive": true}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:57:14.619
cmq9mgovy000gtsighka1oseg	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	ITEM_ADDED	DIAGNOSTIC · ijijj × 1 @ 250000	\N	{"kind": "DIAGNOSTIC", "total": "250000", "itemId": "cmq9mgovt000ftsigebzfa2ww", "quantity": "1", "serviceId": null, "unitPrice": "250000", "description": "ijijj"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:57:56.734
cmq9mguj9000itsig698mdmk9	ServiceOrder	cmq4mwh0j0000swig6qpfa2k8	ITEM_ADDED	LABOR · Тос солих × 1 @ 50000	\N	{"kind": "LABOR", "total": "50000", "itemId": "cmq9mguj4000htsigjjpgo5ho", "quantity": "1", "serviceId": "cmpp91xdt000eskigq5vadzir", "unitPrice": "50000", "description": "Тос солих"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:58:04.053
cmq9mhuxb000ktsigvjtn6nu5	ServiceOrder	cmpz8gsxp000wp4iginmtpi46	PAYMENT_CHANGE	QPay QR үүсгэв · 70000₮	\N	{"amount": "70000", "paymentId": "cmq9mhunx000jtsignzobx1is"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 14:58:51.215
cmq9mryig000stsigla9ox0fg	Appointment	cmq9mr6p7000otsig6mq9td2w	STATUS_CHANGE	Цаг баталгаажуулсан	\N	{"status": "CONFIRMED", "vehicleId": "cmq9mryi6000rtsigeoigbxx7", "customerId": "cmq9mryhz000qtsigbvlytwus"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	cmpxovzbe001558igh6sqsct4	\N	\N	2026-06-11 15:06:42.424
cmq9mslaa000wtsigmnsmk7bw	ServiceOrder	cmq9msl9w000utsigh2bswdtl	CREATE	Захиалга үүсгэсэн	\N	{"branchId": "cmpxovzbe001558igh6sqsct4", "vehicleId": "cmq9mryi6000rtsigeoigbxx7", "customerId": "cmq9mryhz000qtsigbvlytwus", "scheduledAt": "2026-06-12T08:00:00.000Z", "assignedToId": "cmq7rcfh90006lgigsifmc02v"}	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 15:07:11.938
cmq9mt2c0000xtsigxsukigaw	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-11 15:07:34.032
cmq9mvj8q0010tsigy56nq9in	User	cmpp65q9z0002wkiggzquyx9n	LOGIN	act@a.mn	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp65q9z0002wkiggzquyx9n	\N	\N	\N	2026-06-11 15:09:29.258
cmqj8u1n40001x8ig3r8msxkh	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-18 08:34:06.928
cmqj8zq080002x8igm27oe1m9	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-18 08:38:31.784
cmqj9119w0004x8igdaksxgin	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-18 08:39:33.045
cmqkdf90g0001dcignsg240rx	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-19 03:30:20.896
cmqqb0j6k0001hsigv68jbp69	User	cmpp3f50i000l0kigcn8nely8	LOGIN	jijgee647@gmail.com	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-23 07:09:32.06
cmqqd2ss30002hsigmy5nr7cg	User	cmpp3f50i000l0kigcn8nely8	LOGOUT	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	\N	\N	2026-06-23 08:07:17.043
\.


--
-- Data for Name: Branch; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Branch" (id, name, phone, "isPrimary", city, district, khoroo, address, latitude, longitude, "openTime", "closeTime", "tenantId", "createdAt", "updatedAt", "slotCapacity", "slotMinutes") FROM stdin;
cmpyt2dag000dywig1wufz5r1	Хааны өргөө	88005520	t	\N	\N	\N	\N	\N	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.896	2026-06-04 01:24:47.636	\N	\N
cmpytbgrp0014ywigy6zb3nio	Бурханхалдун	70005000	f	\N	\N	\N	\N	\N	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:24:22.309	2026-06-04 01:24:58.748	\N	\N
cmpytcl99001tywige6itdj46	Ононмөрөн	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:25:14.781	2026-06-04 01:25:14.781	\N	\N
cmpytczmf0022ywigp3qzt220	Бээжин	\N	f	\N	\N	\N	\N	\N	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:25:33.399	2026-06-04 01:25:33.399	\N	\N
cmpxovzbe001558igh6sqsct4	Tovchoo	85502020	f	Ulaanbaatar	Сонгино хайрхан	1	Ulaanbaat	47.876663	106.606221	09:00	18:00	cmpp3f4zb00020kigzdmly5ii	2026-06-03 06:32:35.21	2026-06-05 09:14:36.621	\N	\N
cmpp3f4zw000d0kiggeq0lcat	Үндсэн салбар	70116543	t	\N	\N	\N	\N	47.921735	106.901135	11:00	20:00	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.076	2026-06-05 09:50:20.204	1	\N
\.


--
-- Data for Name: BranchSchedule; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."BranchSchedule" (id, weekday, "isOpen", "openTime", "closeTime", "branchId", "createdAt", "updatedAt") FROM stdin;
cmpyt2dak000eywig8we4qqaf	MON	t	\N	\N	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:17:17.9	2026-06-04 01:24:47.645
cmpyt2dak000fywigzm1i49og	TUE	t	\N	\N	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:17:17.9	2026-06-04 01:24:47.65
cmpyt2dak000gywig770x0vhb	WED	t	\N	\N	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:17:17.9	2026-06-04 01:24:47.652
cmpyt2dak000hywigteox694z	THU	t	\N	\N	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:17:17.9	2026-06-04 01:24:47.654
cmpyt2dak000iywigm23gts61	FRI	t	\N	\N	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:17:17.9	2026-06-04 01:24:47.656
cmpyt2dal000jywigv9jj7n26	SAT	f	\N	\N	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:17:17.9	2026-06-04 01:24:47.659
cmpyt2dal000kywig3tu7zmxo	SUN	f	\N	\N	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:17:17.9	2026-06-04 01:24:47.661
cmpytbgrs0015ywigietd06ef	MON	t	\N	\N	cmpytbgrp0014ywigy6zb3nio	2026-06-04 01:24:22.312	2026-06-04 01:24:58.751
cmpytbgrs0016ywigroit5lym	TUE	t	\N	\N	cmpytbgrp0014ywigy6zb3nio	2026-06-04 01:24:22.312	2026-06-04 01:24:58.753
cmpytbgrs0017ywigz351ityu	WED	t	\N	\N	cmpytbgrp0014ywigy6zb3nio	2026-06-04 01:24:22.312	2026-06-04 01:24:58.755
cmpytbgrs0018ywig48fvo00m	THU	t	\N	\N	cmpytbgrp0014ywigy6zb3nio	2026-06-04 01:24:22.312	2026-06-04 01:24:58.756
cmpytbgrt0019ywig21bhz2f7	FRI	t	\N	\N	cmpytbgrp0014ywigy6zb3nio	2026-06-04 01:24:22.312	2026-06-04 01:24:58.758
cmpytbgrt001aywigcuzfbfdl	SAT	f	\N	\N	cmpytbgrp0014ywigy6zb3nio	2026-06-04 01:24:22.312	2026-06-04 01:24:58.76
cmpytbgrt001bywigvdop5olm	SUN	f	\N	\N	cmpytbgrp0014ywigy6zb3nio	2026-06-04 01:24:22.312	2026-06-04 01:24:58.761
cmpytcl9d001uywignnr5uw30	MON	t	\N	\N	cmpytcl99001tywige6itdj46	2026-06-04 01:25:14.785	2026-06-04 01:25:14.785
cmpytcl9d001vywig7ypn0phk	TUE	t	\N	\N	cmpytcl99001tywige6itdj46	2026-06-04 01:25:14.785	2026-06-04 01:25:14.785
cmpytcl9d001wywigcrby0m74	WED	t	\N	\N	cmpytcl99001tywige6itdj46	2026-06-04 01:25:14.785	2026-06-04 01:25:14.785
cmpytcl9d001xywigx8yrq34r	THU	t	\N	\N	cmpytcl99001tywige6itdj46	2026-06-04 01:25:14.785	2026-06-04 01:25:14.785
cmpytcl9d001yywigouqp636s	FRI	t	\N	\N	cmpytcl99001tywige6itdj46	2026-06-04 01:25:14.785	2026-06-04 01:25:14.785
cmpytcl9d001zywigmfy4rjmt	SAT	f	\N	\N	cmpytcl99001tywige6itdj46	2026-06-04 01:25:14.785	2026-06-04 01:25:14.785
cmpytcl9d0020ywigxkjfpcku	SUN	f	\N	\N	cmpytcl99001tywige6itdj46	2026-06-04 01:25:14.785	2026-06-04 01:25:14.785
cmpytczmj0023ywigax4al3ld	MON	t	\N	\N	cmpytczmf0022ywigp3qzt220	2026-06-04 01:25:33.403	2026-06-04 01:25:33.403
cmpytczmj0024ywigoqysbrqi	TUE	t	\N	\N	cmpytczmf0022ywigp3qzt220	2026-06-04 01:25:33.403	2026-06-04 01:25:33.403
cmpytczmj0025ywigtickjrlh	WED	t	\N	\N	cmpytczmf0022ywigp3qzt220	2026-06-04 01:25:33.403	2026-06-04 01:25:33.403
cmpytczmj0026ywigp0nf5o8f	THU	t	\N	\N	cmpytczmf0022ywigp3qzt220	2026-06-04 01:25:33.403	2026-06-04 01:25:33.403
cmpytczmj0027ywig0myq8g49	FRI	t	\N	\N	cmpytczmf0022ywigp3qzt220	2026-06-04 01:25:33.403	2026-06-04 01:25:33.403
cmpytczmj0028ywiggq8gjray	SAT	f	\N	\N	cmpytczmf0022ywigp3qzt220	2026-06-04 01:25:33.403	2026-06-04 01:25:33.403
cmpytczmj0029ywign41kisx7	SUN	f	\N	\N	cmpytczmf0022ywigp3qzt220	2026-06-04 01:25:33.403	2026-06-04 01:25:33.403
cmpxovzbz001658igyxepgg90	MON	t	\N	\N	cmpxovzbe001558igh6sqsct4	2026-06-03 06:32:35.231	2026-06-05 09:14:36.625
cmpxovzbz001758ig9gsbm021	TUE	t	\N	\N	cmpxovzbe001558igh6sqsct4	2026-06-03 06:32:35.231	2026-06-05 09:14:36.628
cmpxovzbz001858iglmykje7p	WED	t	\N	\N	cmpxovzbe001558igh6sqsct4	2026-06-03 06:32:35.231	2026-06-05 09:14:36.639
cmpxovzbz001958igw0einujr	THU	t	\N	\N	cmpxovzbe001558igh6sqsct4	2026-06-03 06:32:35.231	2026-06-05 09:14:36.641
cmpxovzbz001a58ignplb4fy0	FRI	t	\N	\N	cmpxovzbe001558igh6sqsct4	2026-06-03 06:32:35.231	2026-06-05 09:14:36.643
cmpxovzbz001b58ig8eprzog0	SAT	f	\N	\N	cmpxovzbe001558igh6sqsct4	2026-06-03 06:32:35.231	2026-06-05 09:14:36.646
cmpxovzbz001c58ig513063n4	SUN	f	\N	\N	cmpxovzbe001558igh6sqsct4	2026-06-03 06:32:35.231	2026-06-05 09:14:36.649
cmpp3f50e000e0kig09orhb1y	MON	t	\N	\N	cmpp3f4zw000d0kiggeq0lcat	2026-05-28 06:09:28.094	2026-06-05 09:50:20.208
cmpp3f50e000f0kigyouryoj3	TUE	t	\N	\N	cmpp3f4zw000d0kiggeq0lcat	2026-05-28 06:09:28.094	2026-06-05 09:50:20.211
cmpp3f50e000g0kig8o06lewy	WED	t	\N	\N	cmpp3f4zw000d0kiggeq0lcat	2026-05-28 06:09:28.094	2026-06-05 09:50:20.213
cmpp3f50e000h0kigv0ienyli	THU	t	\N	\N	cmpp3f4zw000d0kiggeq0lcat	2026-05-28 06:09:28.094	2026-06-05 09:50:20.214
cmpp3f50e000i0kig035y1wgf	FRI	t	\N	\N	cmpp3f4zw000d0kiggeq0lcat	2026-05-28 06:09:28.094	2026-06-05 09:50:20.216
cmpp3f50e000j0kig2v52ov7t	SAT	f	\N	\N	cmpp3f4zw000d0kiggeq0lcat	2026-05-28 06:09:28.094	2026-06-05 09:50:20.22
cmpp3f50e000k0kignaakwpnx	SUN	f	\N	\N	cmpp3f4zw000d0kiggeq0lcat	2026-05-28 06:09:28.094	2026-06-05 09:50:20.223
\.


--
-- Data for Name: Customer; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Customer" (id, "fullName", phone, email, note, "tenantId", "createdAt", "updatedAt", "accountId") FROM stdin;
cmpw2vzqm00037gigjvzm2ggo	Anar	86555442	anar@a.mn	\N	cmpp3f4zb00020kigzdmly5ii	2026-06-02 03:28:58.03	2026-06-02 03:28:58.03	\N
cmpxf9px0000958iged59vy6g	Энхболд	90123322	\N	\N	cmpp3f4zb00020kigzdmly5ii	2026-06-03 02:03:20.052	2026-06-03 02:03:20.052	\N
cmpxjppah000t58igtxlsn98e		99503223	\N	\N	cmpp3f4zb00020kigzdmly5ii	2026-06-03 04:07:44.201	2026-06-03 04:07:44.201	\N
cmpxjvjl9000v58ig69elnijp		99385882	\N	\N	cmpp3f4zb00020kigzdmly5ii	2026-06-03 04:12:16.749	2026-06-03 04:12:16.749	\N
cmpxl64xb001258igrl7xr19y		93095554	\N	\N	cmpp3f4zb00020kigzdmly5ii	2026-06-03 04:48:30.575	2026-06-03 04:48:30.575	\N
cmpyt5n72000tywig3pfooet5		98665523	\N	\N	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:19:50.702	2026-06-04 01:20:12.127	\N
cmpzamlob001gp4iglhbbals7		90112233	\N	\N	cmpp3f4zb00020kigzdmly5ii	2026-06-04 09:28:55.355	2026-06-04 09:28:55.355	\N
cmpzaydyr001ip4ig626t8g5w		90908888	\N	\N	cmpp3f4zb00020kigzdmly5ii	2026-06-04 09:38:05.235	2026-06-04 09:38:05.235	\N
cmpp97fuu000xskigwzjjipz4	Myagmardorj Naimanjin	95733832	jijgee647@gmail.com	\N	cmpp3f4zb00020kigzdmly5ii	2026-05-28 08:51:26.598	2026-06-05 06:06:04.04	cmq0iqvi000050wig4qtz67se
cmq9mryhz000qtsigbvlytwus	Цаг захиалсан хэрэглэгч	99509510	\N	\N	cmpp3f4zb00020kigzdmly5ii	2026-06-11 15:06:42.407	2026-06-11 15:06:42.407	cmq9moi03000mtsigntztk94s
\.


--
-- Data for Name: Device; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Device" (id, "deviceId", platform, "firebaseToken", name, model, os, "userId", "accountId", "createdAt", "updatedAt", "lastSeenAt") FROM stdin;
cmq96mhx7000nhsig34rf4ftm	87f3ed31d78a11185516380141e6b734	IOS	\N	\N	\N	\N	cmpp3f50i000l0kigcn8nely8	\N	2026-06-11 07:34:33.787	2026-06-11 15:06:06.937	2026-06-11 07:34:33.786
cmq97mo970005a0ig81ey8gh3	f02b22c837473b0c8ab30c48fa1518b8	IOS	\N	\N	\N	\N	cmpp3f50i000l0kigcn8nely8	\N	2026-06-11 08:02:41.611	2026-06-11 15:06:06.937	2026-06-11 08:02:41.607
\.


--
-- Data for Name: DiagnosticReport; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DiagnosticReport" (id, "templateVersion", data, "signatureUrl", "mileageAtReport", notes, "tenantId", "templateId", "orderId", "customerId", "vehicleId", "branchId", "filledById", "createdAt", "updatedAt") FROM stdin;
cmpw3g53b00057gigifsjp8j5	1	{"item_6o0cgpuk": {"value": "Засах"}}	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpq9mpgc001jskigm99c72z9	\N	cmpp97fuu000xskigwzjjipz4	cmpw2vd6k00017gigvupsekga	cmpp3f4zw000d0kiggeq0lcat	cmpp65q9z0002wkiggzquyx9n	2026-06-02 03:44:38.087	2026-06-02 03:44:38.087
cmpw8fkya00007wigrfztevoq	1	{"item_4d1qycwa": {"value": "Анхаарах"}, "item_6atf9092": {"value": "Засах"}, "item_h8axk7r1": {"value": "Засах"}, "item_ji6on0z2": {"value": "Анхаарах"}, "item_og4eh5ao": {"value": "Анхаарах"}}	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp9e303001bskiggu0xn4g0	\N	cmpp97fuu000xskigwzjjipz4	cmpp97qo0000zskiglwc4hrj5	cmpp3f4zw000d0kiggeq0lcat	cmpp65q9z0002wkiggzquyx9n	2026-06-02 06:04:10.066	2026-06-02 06:04:10.066
cmpxgdl81000p58igshx37mv3	1	{"item_6o0cgpuk": {"value": "Анхаарах"}}	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpq9mpgc001jskigm99c72z9	cmpp97sxv0011skigp5jl7f7x	cmpp97fuu000xskigwzjjipz4	cmpp97qo0000zskiglwc4hrj5	cmpp3f4zw000d0kiggeq0lcat	cmpp65q9z0002wkiggzquyx9n	2026-06-03 02:34:20.209	2026-06-03 02:34:20.209
cmpxgl5tu000q58igkmn99ca8	1	{"item_4d1qycwa": {"value": "OK"}, "item_h8axk7r1": {"value": "Засах"}, "item_ji6on0z2": {"value": "OK"}, "item_og4eh5ao": {"value": "Засах"}}	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp9e303001bskiggu0xn4g0	cmpp97sxv0011skigp5jl7f7x	cmpp97fuu000xskigwzjjipz4	cmpp97qo0000zskiglwc4hrj5	cmpp3f4zw000d0kiggeq0lcat	cmpp65q9z0002wkiggzquyx9n	2026-06-03 02:40:13.506	2026-06-03 02:40:13.506
cmpyume6a002hywigxxlcec51	1	{"item_4gv8u74m": {"value": "OK"}, "item_50g6likx@L": {}, "item_50g6likx@R": {}, "item_a99yzuet@B": {}, "item_a99yzuet@F": {}, "item_lfwvinf5@FL": {}, "item_lfwvinf5@FR": {}, "item_lfwvinf5@RL": {}, "item_lfwvinf5@RR": {}}	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmpyuk939002bywigh1uqdvzz	cmpyul7ds002dywigx30lwh7u	cmpyt5n72000tywig3pfooet5	cmpyt612e000wywigarj4u3f8	cmpytcl99001tywige6itdj46	cmpyt2dap000lywigv9rpp34j	2026-06-04 02:00:51.778	2026-06-04 02:00:51.778
cmq7ey26j0003scigsbcqw5fc	2	{"item_6o0cgpuk": {"value": "Анхаарах"}, "item_xuhabsd1@B": {"value": "OK"}, "item_xuhabsd1@F": {"value": "Анхаарах"}, "item_yvhwqnlb@L": {"value": "OK"}, "item_yvhwqnlb@R": {"value": "OK"}, "item_895j0r1p@FL": {"value": "OK"}, "item_895j0r1p@FR": {"value": "OK"}, "item_895j0r1p@RL": {"value": "OK"}, "item_895j0r1p@RR": {"value": "Анхаарах"}}	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpq9mpgc001jskigm99c72z9	cmq0981o200032oigxqnfdgmq	cmpp97fuu000xskigwzjjipz4	cmpp97qo0000zskiglwc4hrj5	cmpxovzbe001558igh6sqsct4	cmpp3f50i000l0kigcn8nely8	2026-06-10 01:51:57.835	2026-06-10 01:51:57.835
\.


--
-- Data for Name: DiagnosticTemplate; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."DiagnosticTemplate" (id, name, description, type, schema, version, "isActive", price, "durationMin", "tenantId", "createdById", "createdAt", "updatedAt") FROM stdin;
cmpp9e303001bskiggu0xn4g0	Undsen	\N	INTAKE	{"sections": [{"id": "sec_ag111qlu", "items": [{"id": "item_4d1qycwa", "type": "check", "label": "Кузовын байдал", "options": ["OK", "Анхаарах", "Засах"], "required": true}, {"id": "item_6atf9092", "type": "check", "label": "Шинэ асуулт", "options": ["OK", "Анхаарах", "Засах"], "required": false, "showWhen": {"itemId": "item_4d1qycwa", "values": ["Анхаарах"]}}, {"id": "item_ji6on0z2", "type": "check", "label": "Шинэ асуулт-2", "options": ["OK", "Анхаарах", "Засах", "Demo"], "required": false}], "title": "Үндсэн үзлэг"}, {"id": "sec_300z11ou", "items": [{"id": "item_og4eh5ao", "type": "check", "label": "Holiin gerel", "options": ["OK", "Анхаарах", "Засах"], "required": false}, {"id": "item_h8axk7r1", "type": "check", "label": "Oiriin", "options": ["OK", "Анхаарах", "Засах"], "required": false}], "title": "Gerel dohio"}]}	1	t	50000.00	15	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	2026-05-28 08:56:36.531	2026-05-29 01:53:42.472
cmpyuk939002bywigh1uqdvzz	jiriin	\N	INTAKE	{"sections": [{"id": "sec_ohp9nhdg", "items": [{"id": "item_4gv8u74m", "type": "check", "label": "Кузовын байдал", "options": ["OK", "Анхаарах", "Засах"], "required": true}, {"id": "item_lfwvinf5", "type": "check", "label": "Dugui", "options": ["OK", "Анхаарах", "Засах"], "required": false, "positionSet": "CORNERS"}, {"id": "item_a99yzuet", "type": "check", "label": "Undugun tulguur", "options": ["OK", "Анхаарах", "Засах"], "required": false, "positionSet": "FB"}, {"id": "item_50g6likx", "type": "check", "label": "Toli", "options": ["OK", "Анхаарах", "Засах"], "required": false, "positionSet": "LR"}], "title": "Үндсэн үзлэг"}]}	1	t	15000.00	5	cmpyt2d9g0002ywigy2javyr9	cmpyt2dap000lywigv9rpp34j	2026-06-04 01:59:11.877	2026-06-04 01:59:11.877
cmpq9mpgc001jskigm99c72z9	Demo	\N	INTAKE	{"sections": [{"id": "sec_wrjsmeat", "items": [{"id": "item_6o0cgpuk", "type": "check", "label": "Кузовын байдал", "options": ["OK", "Анхаарах", "Засах"], "required": true}, {"id": "item_yvhwqnlb", "type": "check", "label": "Шинэ асуулт", "options": ["OK", "Анхаарах", "Засах"], "required": false, "positionSet": "LR"}, {"id": "item_xuhabsd1", "type": "check", "label": "Шинэ асуулт", "options": ["OK", "Анхаарах", "Засах"], "required": false, "positionSet": "FB"}, {"id": "item_895j0r1p", "type": "check", "label": "Шинэ асуулт", "options": ["OK", "Анхаарах", "Засах"], "required": false, "positionSet": "CORNERS"}], "title": "Үндсэн үзлэг"}]}	2	t	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	2026-05-29 01:51:05.052	2026-06-04 04:23:30.134
cmq9mfsdw000dtsigm5rhn2rs	ijijj	\N	INTAKE	{"sections": [{"id": "sec_62nevmcu", "items": [{"id": "item_8vtzjmz6", "type": "check", "label": "Кузовын байдал", "options": ["OK", "Анхаарах", "Засах"], "required": true, "positionSet": "CORNERS"}, {"id": "item_8849brwv", "type": "text", "label": "Шинэ асуулт", "required": true}], "title": "Үндсэн үзлэг"}, {"id": "sec_9jmj3t6n", "items": [{"id": "item_gs8p0k3p", "type": "text", "label": "Шинэ асуулт", "required": true, "positionSet": "LR"}], "title": "Шинэ хэсэг"}]}	1	t	250000.00	10	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	2026-06-11 14:57:14.612	2026-06-11 14:57:14.612
\.


--
-- Data for Name: LaborCategory; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."LaborCategory" (id, name, description, "isActive", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmpp90ph00008skigohfh8dp5	Ангилал-1	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 08:46:12.468	2026-05-28 08:46:12.468
cmpp90xuj000askigd8v7w2pb	Хөдөлгүүр	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 08:46:23.323	2026-05-28 08:46:23.323
cmpp917sl000cskigf5xlf3a7	Тоормос	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 08:46:36.213	2026-05-28 08:46:36.213
cmpyut7lz002nywig0e8lxyoj	Demo	\N	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 02:06:09.863	2026-06-04 02:06:09.863
\.


--
-- Data for Name: Notification; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Notification" (id, "tenantId", "userId", "accountId", type, title, body, data, "dedupeKey", "readAt", "createdAt") FROM stdin;
cmq7i54pg0005scigitgc4u7y	\N	\N	cmq0iqvi000050wig4qtz67se	appointment_confirmed	Цаг баталгаажлаа	Таны захиалсан цаг баталгаажлаа.	{"type": "appointment_confirmed", "appointmentId": "cmq0qv4as0016wgigpuz6d62h"}	\N	\N	2026-06-10 03:21:26.548
cmq61vx5g0003zcigy0zt3kjw	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	appointment_created	Шинэ цаг захиалга	Myagmardorj Naimanjin — VI/18 15:30 цагт цаг захиаллаа.	{"type": "appointment_created", "appointmentId": "cmq61vx4z0002zcigbo0auuu0"}	\N	2026-06-10 06:30:44.108	2026-06-09 02:58:36.82
cmq8x8d1s0006hsig2g8s00i9	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	appointment_created	Шинэ цаг захиалга	99004322 — VI/25 16:00 цагт цаг захиаллаа.	{"type": "appointment_created", "appointmentId": "cmq8x8d1d0005hsigap4jxacf"}	\N	\N	2026-06-11 03:11:37.744
cmq9mr6pq000ptsigk2phbhzc	cmpp3f4zb00020kigzdmly5ii	cmpp3f50i000l0kigcn8nely8	\N	appointment_created	Шинэ цаг захиалга	99509510 — VI/12 16:00 цагт цаг захиаллаа.	{"type": "appointment_created", "appointmentId": "cmq9mr6p7000otsig6mq9td2w"}	\N	2026-06-11 15:06:21.902	2026-06-11 15:06:06.398
cmq9mryim000ttsigee9y3c8r	\N	\N	cmq9moi03000mtsigntztk94s	appointment_confirmed	Цаг баталгаажлаа	Таны захиалсан цаг баталгаажлаа.	{"type": "appointment_confirmed", "appointmentId": "cmq9mr6p7000otsig6mq9td2w"}	\N	\N	2026-06-11 15:06:42.43
\.


--
-- Data for Name: OrderDiagnostic; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OrderDiagnostic" (id, "orderId", "templateId", "createdAt") FROM stdin;
cmpz7nyu3000gp4ig2713od01	cmpz7nytd000fp4igtihkpv2x	cmpq9mpgc001jskigm99c72z9	2026-06-04 08:06:00.219
cmpz7nyu3000hp4igo3bt441z	cmpz7nytd000fp4igtihkpv2x	cmpp9e303001bskiggu0xn4g0	2026-06-04 08:06:00.219
cmpz8gsy0000xp4igngujvn4z	cmpz8gsxp000wp4iginmtpi46	cmpq9mpgc001jskigm99c72z9	2026-06-04 08:28:25.608
cmpz8gsy0000yp4ig688himru	cmpz8gsxp000wp4iginmtpi46	cmpp9e303001bskiggu0xn4g0	2026-06-04 08:28:25.608
cmq4mwh160001swigqlz2v34g	cmq4mwh0j0000swig6qpfa2k8	cmpp9e303001bskiggu0xn4g0	2026-06-08 03:11:22.17
cmq9m82t30003tsig077b1pw4	cmq9m82sm0002tsigwfsv89bu	cmpq9mpgc001jskigm99c72z9	2026-06-11 14:51:14.871
cmq9msla7000vtsigcygx82th	cmq9msl9w000utsigh2bswdtl	cmq9mfsdw000dtsigm5rhn2rs	2026-06-11 15:07:11.935
\.


--
-- Data for Name: OrderPayment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."OrderPayment" (id, "tenantId", "orderId", amount, currency, method, status, "qpayInvoiceId", "qpayPaymentId", "qrImage", "qrText", "paidAt", "createdAt", "updatedAt", "qpayUrls") FROM stdin;
cmpp983tq0015skig0s0osdbu	cmpp3f4zb00020kigzdmly5ii	cmpp97sxv0011skigp5jl7f7x	50000.00	MNT	QPAY	PENDING	8bb06440-b982-4b2e-b386-f5a81a171560	\N	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	0002010102121531279404962794049600260513551182827540014A00000084300010108CAXBMNUB0220MiyrHe7H8RQIeYusnuCw5204737253034965405500005802MN5912INFOSISTYEMS6011ULAANBAATAR62240720MiyrHe7H8RQIeYusnuCw7106QPP_QR781530452289060608479022280020263049E3D	\N	2026-05-28 08:51:57.662	2026-05-28 08:51:57.961	\N
cmpq9qowv001tskig9pcyfe5d	cmpp3f4zb00020kigzdmly5ii	cmpp9jj8b001fskigltmlizc7	100000.00	MNT	QPAY	PENDING	a463e7cc-1c00-4eb8-bec8-3724e5836f01	\N	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	0002010102121531279404962794049600260513624249827540014A00000084300010108CAXBMNUB0220LcBoVYkk0a_iKR1RnLtf52047372530349654061000005802MN5912INFOSISTYEMS6011ULAANBAATAR62240720LcBoVYkk0a_iKR1RnLtf7106QPP_QR7815825444984287326790222800202630468DC	\N	2026-05-29 01:54:10.975	2026-05-29 01:54:11.123	\N
cmpxdskr7000458igczgvsyqk	cmpp3f4zb00020kigzdmly5ii	cmpwagqsx00027wigb955jwg8	20000.00	MNT	QPAY	PENDING	a345e8fc-f9cb-4599-8b87-9acdb9b95661	\N	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	0002010102121531279404962794049600260610244028027540014A00000084300010108CAXBMNUB0220TEUIhMaUSR8_VcI7y2ic5204737253034965405200005802MN5912INFOSISTYEMS6011ULAANBAATAR62240720TEUIhMaUSR8_VcI7y2ic7106QPP_QR781505493593038634279022280020263043923	\N	2026-06-03 01:22:00.595	2026-06-03 01:22:01.319	\N
cmq96s34m0000a0ig5cek4aza	cmpp3f4zb00020kigzdmly5ii	cmq4mwh0j0000swig6qpfa2k8	70000.00	MNT	QPAY	CANCELLED	1e04a440-c578-4d91-8d99-d80524c6a1e5	\N	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	0002010102121531279404962794049600260611323756127540014A00000084300010108CAXBMNUB0220klcXkFMNOpN6NSr3V9vL5204737253034965405700005802MN5912INFOSISTYEMS6011ULAANBAATAR62240720klcXkFMNOpN6NSr3V9vL7106QPP_QR78157913689055045747902228002026304A9ED	\N	2026-06-11 07:38:54.55	2026-06-11 07:40:32.928	\N
cmq96ua120002a0igoog5sm9e	cmpp3f4zb00020kigzdmly5ii	cmq4mwh0j0000swig6qpfa2k8	70000.00	MNT	QPAY	PENDING	f4950278-dac3-4acc-9c60-3c34cf68d4d8	\N	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	0002010102121531279404962794049600260611324050127540014A00000084300010108CAXBMNUB0220JxbgU3Q-7HWqwCRQ7AW35204737253034965405700005802MN5912INFOSISTYEMS6011ULAANBAATAR62240720JxbgU3Q-7HWqwCRQ7AW37106QPP_QR781595765372758955479022280020263042712	\N	2026-06-11 07:40:36.806	2026-06-11 07:40:37.084	\N
cmq9mhunx000jtsignzobx1is	cmpp3f4zb00020kigzdmly5ii	cmpz8gsxp000wp4iginmtpi46	70000.00	MNT	QPAY	PENDING	70a63af9-a1ab-4f49-8889-d16de4fce640	\N	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	0002010102121531279404962794049600260611383611627540014A00000084300010108CAXBMNUB0220E0eiRwjZy6l7h-orTMAj5204737253034965405700005802MN5912INFOSISTYEMS6011ULAANBAATAR62240720E0eiRwjZy6l7h-orTMAj7106QPP_QR781592244445917093779022280020263040668	\N	2026-06-11 14:58:50.877	2026-06-11 14:58:51.207	\N
\.


--
-- Data for Name: Otp; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Otp" (id, email, "codeHash", type, attempts, "consumedAt", "expiresAt", "createdAt", "userId", ip, "userAgent", "accountId", phone) FROM stdin;
cmpp3bvb4000558ig86w3cu63	jijgee647@gmail.com	fadf758d48f013b706266a43de560a739937c309d3839398e626f524409d4330	SIGNUP	0	2026-05-28 06:07:04.982	2026-05-28 06:16:55.534	2026-05-28 06:06:55.552	\N	::ffff:192.168.88.114	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	\N
cmpp3co4e00000kigqecgfylc	jijgee647@gmail.com	8eb07e1b0b68991bef4af3213ca6dcccae000b6dcb1ac7a8400528ba2ce52822	SIGNUP	0	2026-05-28 06:08:21.769	2026-05-28 06:17:32.841	2026-05-28 06:07:32.894	\N	::ffff:192.168.88.114	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	\N
cmq7sfb380001mgig0zg3vkiv	enhjino@gmail.com	a2eee55e6b90b2cfe9842c6d5cd49d7634cc281c9ab5778d51cc0f6e0f66f952	SET_PASSWORD	0	2026-06-10 08:10:04.398	2026-06-10 08:19:17.527	2026-06-10 08:09:17.54	cmq7rcfh90006lgigsifmc02v	::ffff:192.168.88.55	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N
cmq7tz76e0008mgigokuwuns0	bambar@gmail.com	1a3b513fb63a9fd803c1db391f055f33d1661f02466cd506219c4362dfa59b04	SET_PASSWORD	0	2026-06-10 08:53:15.33	2026-06-10 09:02:45.196	2026-06-10 08:52:45.206	cmq7tyuij0006mgigvces5iyb	::ffff:192.168.88.55	Dart/3.11 (dart:io)	\N	\N
cmpp3dpu600010kigul8dumro	jijgee647@gmail.com	897c6b1cd1ed2378a1e0381b26f60dd7d56b390b19764e8ce4b2afcaf372d9d6	SIGNUP	3	2026-05-28 06:09:27.727	2026-05-28 06:18:21.766	2026-05-28 06:08:21.774	\N	::ffff:192.168.88.114	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	\N
cmpyt21nd0001ywiggizqtj6t	uguudei@a.mn	6361d94d83130079eed45763e7bf601ee39da90f92cf6850a6f4d29c3ce72bd6	SIGNUP	0	2026-06-04 01:17:17.538	2026-06-04 01:27:02.778	2026-06-04 01:17:02.809	\N	::ffff:192.168.88.114	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	\N
cmq0iqlbr00040wigrw6q5tzx	\N	9192ebbcf7f1d2eda8f80828b2934883ac2827c6c39de1b97c4867c4c929a90a	CONSUMER_LOGIN	0	2026-06-05 06:03:57.805	2026-06-05 06:13:44.607	2026-06-05 06:03:44.631	\N	::ffff:192.168.88.55	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	95733832
cmq0kxzrm0000asig4vhiy5bh	\N	e46ad40faec9b5f50bc9213a417cfee0adf2bebd71c10724972eabe81954859f	CONSUMER_LOGIN	0	2026-06-05 07:05:56.654	2026-06-05 07:15:29.138	2026-06-05 07:05:29.17	\N	::ffff:192.168.88.55	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	90908888
cmq0lsxhy0003i0igmhk8vxpw	\N	c8c0d8809df6061d3f4737a0121bb9c9fe7c69f7f5493c01fbdd5066d4b51207	CONSUMER_LOGIN	0	2026-06-05 07:29:41.826	2026-06-05 07:39:32.46	2026-06-05 07:29:32.566	\N	::ffff:192.168.88.55	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	95733832
cmq0r2kk70017wgigqjdkok0s	\N	4d46350a082fa3757deb8cf7f6628b323b8e186c436d04c27bdffcb3d0003c5f	CONSUMER_LOGIN	0	2026-06-05 09:57:10.047	2026-06-05 10:07:00.421	2026-06-05 09:57:00.439	\N	::ffff:192.168.88.55	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	\N	95733832
cmq61vclr0001zcigs9vjc0lr	\N	ada09aa32aa9992459a65623fbc71a697f0e64f34d76158dcbc6d56458300b2a	CONSUMER_LOGIN	0	2026-06-09 02:58:22.048	2026-06-09 03:08:10.102	2026-06-09 02:58:10.192	\N	::ffff:192.168.88.55	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	95733832
cmq7oq6ov000070ignelyzl5z	act@a.mn	bd03c6ddeefb94e6e140ca0da7d16c084140eb61205ac7ab491ef13f9819f5f1	RESET_PASSWORD	0	2026-06-10 06:26:14.28	2026-06-10 06:35:46.556	2026-06-10 06:25:46.591	cmpp65q9z0002wkiggzquyx9n	::ffff:192.168.88.55	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N
cmq8x7axp0003hsigvsmdsvcz	\N	53c1799b79899a50c3a4c627110719951201de1cf94ffeda13cfc749efd689ae	CONSUMER_LOGIN	0	2026-06-11 03:11:11.027	2026-06-11 03:20:48.341	2026-06-11 03:10:48.349	\N	::ffff:192.168.88.55	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	99004322
cmq9mo7lo000ltsigi3ex5emx	\N	47bb0e54a605d6e3e4f8dd1eaa834b1c2ff7d749242cfb8267be6189c607bafc	CONSUMER_LOGIN	0	2026-06-11 15:04:01.05	2026-06-11 15:13:47.459	2026-06-11 15:03:47.58	\N	::ffff:192.168.88.39	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36 Edg/149.0.0.0	\N	99509510
cmq9muddu000ytsigzgr6yjzm	act@a.mn	f687acb594b29ce90883e460a2ad1e218edddaf2f34dbab745c3035e8e1ba8c8	RESET_PASSWORD	0	2026-06-11 15:09:18.683	2026-06-11 15:18:35.003	2026-06-11 15:08:35.01	cmpp65q9z0002wkiggzquyx9n	::ffff:192.168.88.39	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	\N	\N
\.


--
-- Data for Name: PlanFeature; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlanFeature" (id, plan, label, value, description, "sortOrder", highlighted, "createdAt", "updatedAt") FROM stdin;
pf_free_users	FREE	Хамгийн их хэрэглэгч	10	\N	1	t	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
pf_free_orders	FREE	Өдрийн захиалга	100	\N	2	f	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
pf_free_services	FREE	Үйлчилгээний тоо	50	\N	3	f	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
pf_biz_users	BUSINESS	Хамгийн их хэрэглэгч	50	\N	1	t	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
pf_biz_orders	BUSINESS	Өдрийн захиалга	250	\N	2	f	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
pf_biz_services	BUSINESS	Үйлчилгээний тоо	150	\N	3	f	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
pf_ent_users	ENTERPRISE	Хамгийн их хэрэглэгч	Хязгааргүй	\N	1	t	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
pf_ent_orders	ENTERPRISE	Өдрийн захиалга	Хязгааргүй	\N	2	t	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
pf_ent_services	ENTERPRISE	Үйлчилгээний тоо	Хязгааргүй	\N	3	t	2026-05-28 12:48:38.39	2026-05-28 12:48:38.39
\.


--
-- Data for Name: PlanLimit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlanLimit" (id, plan, code, label, description, kind, "intValue", "boolValue", "sortOrder", highlighted, "createdAt", "updatedAt") FROM stdin;
cmpp8xmst0006skigu9ie0vl1	FREE	max_users	Ажилтны тоо	Бүртгэх боломжтой нийт хэрэглэгч (OWNER + бусад)	COUNT	5	\N	10	f	2026-05-28 08:43:49.037	2026-06-05 01:59:03.617
cmpp95qen000tskigdqhqetkx	FREE	max_branches	Салбарын тоо	Бүртгэх боломжтой салбарын тоо	COUNT	1	\N	20	f	2026-05-28 08:50:06.959	2026-06-05 01:59:06.982
cmq0a01x400062oigngn82ju4	FREE	max_customers	Үйлчлүүлэгчийн тоо	Бүртгэх боломжтой нийт үйлчлүүлэгч	COUNT	50	\N	30	f	2026-06-05 01:59:09.496	2026-06-05 01:59:09.496
cmq0a04r000072oigsaylnpqp	FREE	max_vehicles	Машины тоо	Бүртгэх боломжтой нийт машин	COUNT	100	\N	40	f	2026-06-05 01:59:13.164	2026-06-05 01:59:13.164
cmq0a07aa00082oigkj5l1xxl	FREE	max_services	Үйлчилгээний тоо	Каталогт байх нийт үйлчилгээ/бараа	COUNT	100	\N	50	f	2026-06-05 01:59:16.45	2026-06-05 01:59:16.45
cmq0a0bc400092oigiw3m17ra	FREE	daily_orders	Өдрийн захиалга	Нэг өдөрт үүсгэх захиалгын тоо	COUNT	30	\N	60	f	2026-06-05 01:59:21.7	2026-06-05 01:59:21.7
cmq0a0i2a000a2oiguq6jo3u0	FREE	max_active_orders	Идэвхтэй захиалга	Дуусаагүй (SCHEDULED/IN_PROGRESS/WAITING_PARTS) захиалгын тоо	COUNT	120	\N	70	f	2026-06-05 01:59:30.418	2026-06-05 01:59:30.418
cmq0a0ovb000b2oiglgktv9bn	FREE	max_diagnostic_templates	Оношилгооны загвар	Зохиох боломжтой нийт оношилгооны загвар	COUNT	5	\N	80	f	2026-06-05 01:59:39.239	2026-06-05 01:59:39.239
cmq0a0r1w000c2oigvvyvwuvs	FREE	enable_diagnostics	Оношилгооны модуль	Оношилгооны загвар + тайлан ашиглах боломж	BOOLEAN	\N	t	100	f	2026-06-05 01:59:42.068	2026-06-05 01:59:42.068
cmq0a0sjb000d2oigxrv3rmzu	FREE	enable_reports	Тайлан	Тайлангийн модулийг нээх	BOOLEAN	\N	t	110	f	2026-06-05 01:59:43.991	2026-06-05 01:59:43.991
cmq0a0voq000e2oiglkq0iesz	FREE	enable_api	API хандалт	Гадаад API/Mobile token ашиглах	BOOLEAN	\N	f	120	f	2026-06-05 01:59:48.074	2026-06-05 01:59:48.074
cmq0a13ys000f2oig0i5h21w0	BUSINESS	max_users	Ажилтны тоо	Бүртгэх боломжтой нийт хэрэглэгч (OWNER + бусад)	COUNT	30	\N	10	f	2026-06-05 01:59:58.804	2026-06-05 01:59:58.804
cmq0a17x5000g2oigl30mldzo	BUSINESS	max_branches	Салбарын тоо	Бүртгэх боломжтой салбарын тоо	COUNT	5	\N	20	f	2026-06-05 02:00:03.929	2026-06-05 02:00:03.929
cmq0a19vs000h2oighs9fyvp1	ENTERPRISE	max_branches	Салбарын тоо	Бүртгэх боломжтой салбарын тоо	COUNT	\N	\N	20	f	2026-06-05 02:00:06.472	2026-06-05 02:00:06.472
cmq0a1f5m000i2oiglyzrx5pd	BUSINESS	max_customers	Үйлчлүүлэгчийн тоо	Бүртгэх боломжтой нийт үйлчлүүлэгч	COUNT	150	\N	30	f	2026-06-05 02:00:13.306	2026-06-05 02:00:13.306
cmq0a1i26000j2oighye5ic5p	BUSINESS	max_vehicles	Машины тоо	Бүртгэх боломжтой нийт машин	COUNT	150	\N	40	f	2026-06-05 02:00:17.07	2026-06-05 02:00:17.07
cmq0a1mlu000k2oig3pellovi	BUSINESS	max_services	Үйлчилгээний тоо	Каталогт байх нийт үйлчилгээ/бараа	COUNT	150	\N	50	f	2026-06-05 02:00:22.962	2026-06-05 02:00:22.962
cmq0a1p4f000l2oigjd7jqw2x	BUSINESS	daily_orders	Өдрийн захиалга	Нэг өдөрт үүсгэх захиалгын тоо	COUNT	100	\N	60	f	2026-06-05 02:00:26.223	2026-06-05 02:00:26.223
cmq0a208e000m2oighcohefkt	BUSINESS	max_active_orders	Идэвхтэй захиалга	Дуусаагүй (SCHEDULED/IN_PROGRESS/WAITING_PARTS) захиалгын тоо	COUNT	250	\N	70	f	2026-06-05 02:00:40.622	2026-06-05 02:00:40.622
cmq0a23n6000n2oigdewcdlfu	BUSINESS	max_diagnostic_templates	Оношилгооны загвар	Зохиох боломжтой нийт оношилгооны загвар	COUNT	10	\N	80	t	2026-06-05 02:00:45.042	2026-06-05 02:00:54.058
\.


--
-- Data for Name: PlanPrice; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlanPrice" (id, plan, period, amount, currency, "isActive", notes, "createdAt", "updatedAt") FROM stdin;
cmpp8xl3s0005skigsqvh94v8	ENTERPRISE	YEAR	900.00	MNT	t	\N	2026-05-28 08:43:46.84	2026-05-28 08:43:46.84
cmpp8xakn0002skig39jc7m0k	BUSINESS	YEAR	90.00	MNT	t	\N	2026-05-28 08:43:33.191	2026-05-28 08:49:16.061
cmpp8x65x0001skigu2dhzx1c	BUSINESS	QUARTER	27.00	MNT	f	\N	2026-05-28 08:43:27.477	2026-05-28 08:49:41.616
cmpp8xh2r0004skigf8g0azfk	ENTERPRISE	QUARTER	270.00	MNT	f	\N	2026-05-28 08:43:41.619	2026-05-28 08:50:02.627
cmpp8x2280000skigg2p6xt8s	BUSINESS	MONTH	10.00	MNT	t	\N	2026-05-28 08:43:22.16	2026-06-08 01:12:22.967
cmpp8xdd20003skig54aqf0yq	ENTERPRISE	MONTH	100.00	MNT	t	\N	2026-05-28 08:43:36.806	2026-06-08 01:12:49.828
\.


--
-- Data for Name: PlatformSetting; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."PlatformSetting" (id, "facebookUrl", "youtubeUrl", "updatedAt") FROM stdin;
\.


--
-- Data for Name: QPaySettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."QPaySettings" (id, username, password, "invoiceCode", "callbackUrl", "accessToken", "refreshToken", "tokenExpiresAt", "refreshTokenExpiresAt", "updatedAt") FROM stdin;
1	INFOSYSTEMS	ZxZIolYq	INFOSYSTEMS_INVOICE	https://merchant.qpay.mn/v2/	enc:v1:JWOHHXj2882nLk0H3ynFaXgvu6Vl6hgiVH4p9zpuv/aw2WRdk0AgF5JXuTLk6MMk7BN5RSXV0+Sq/kNKbegcGN8efZWSvvQ+DZjyHDf1g31e3rgG9DCbXNPJmBSRmidyQIswDTQgKLcyw6gHA//MfrQlTjGQvYpvw3c9ykjQDdkk+KKn8N47xsHBtsV6wTGj4KIrt01RN/56WcyU0ZvocV5zj2JS2q0N4ZdJs09wKp85ZQdjI8S4RCFh73Q/LHtonsoSCwVcrqezEnmX9JsZjUY70m/2ItW4qZ0nk1vvgjWLK1oYtaUvCdpWaBqIzN7RUjvl/tM96PErxwe0UVcF0cqHBhqXo/nATZVaIXFlElujJjZ7b0r7uCO2yMRm/cJuNuHbdI6FtHa+6qeWxAxwbAB3z2K0Pa4OVJZnqrxe7Qsr5K7R6QEegKih0Zr+NdrK6Th+CHCctX1oY0HgsiFifD1uvAJf1xb6zyQm2QRi7r7EY1L9lADVzRVnllgGazeUUM31oNqOR2g=	enc:v1:mdOVewYwgLSnZnPip8IOPlFcmxeeYg6uWFRWF7KRN9SpW3tZoUzYNW7zymQmOdCJ3kSsb/wJ0pjgxfHXJQnoYBK0JtvoAgpujf6c5gjB4opQEfDYlbS2C3+NXiQxsd7nwF3ajC6x1qG9yiw5pNPTQ7m6WdWatTNA8l2c9tTuHmcMOQ4Q7YTEVbLxXyPRcLy9XJ0G+Nfz3n3zLExM6YvUEVU6Q2Je6/lwyEtDoejMaqm3hlPhb0W9mJPSbyIuJ3W44Kxr7YWow5a5lQ5jpTwMp2+22z97phmRL2JnBe8K/ue78n+inEZ3T0bAhStlF0GH88hHKVTFfgTWJr4jbNFANpdD1CgkCRHGOZQ92ps63QCapoimKc7HTJM1gg3BZvtaMzWcMNWrqo0dqNXFKTiUmcXhAG2qnabFEay7KqsxVKxFPWMN0zpKgUGQyMWoxfxc	2026-06-11 03:23:13	2026-06-11 03:23:13	2026-06-10 03:22:43.192
\.


--
-- Data for Name: RefreshToken; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."RefreshToken" (id, "tokenHash", "userId", "expiresAt", "revokedAt", "replacedById", "userAgent", ip, "createdAt", "lastUsedAt") FROM stdin;
cmpw5h0re0001nkig3njqsq77	50ffee5f87afedafae4d929d461d615e011f2b82d68535ee6dc54897c0b44334	cmpp65q9z0002wkiggzquyx9n	2026-06-09 04:41:18.361	2026-06-03 04:41:50.816	cmpxkxkgm001158igj4sdge9r	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-02 04:41:18.363	2026-06-03 04:41:50.816
cmpxkxkgm001158igj4sdge9r	bdc742dbb6e32a86c133a7c55dccdcfe5c7b648bd24f93b0619851c743c60e52	cmpp65q9z0002wkiggzquyx9n	2026-06-10 04:41:50.803	2026-06-04 09:17:50.991	cmpza8d1m001fp4igc4p1qi54	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-03 04:41:50.806	2026-06-04 09:17:50.991
cmpza8d1m001fp4igc4p1qi54	51127810e27d30c54ef5efa6aa375917cab45fc26df3f6b489f9f0cb2a0227f5	cmpp65q9z0002wkiggzquyx9n	2026-06-11 09:17:50.984	2026-06-08 08:58:53.502	cmq4zbe0o000000igragw9oxc	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-04 09:17:50.986	2026-06-08 08:58:53.502
cmq6acog200005oigivvghg7d	7b8a7b0c0d957884c59efbbfc59e11fe7574f02560dc882466ebd66582a31411	cmpp3f50i000l0kigcn8nely8	2026-06-16 06:55:35.609	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-09 06:55:35.618	\N
cmq6acy7l00015oigxktwjs0m	68c57d5131f1b3c55875fdcfead4b6c39000054b4b4874f408fca340c7fb7665	cmpp3f50i000l0kigcn8nely8	2026-06-16 06:55:48.273	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-09 06:55:48.273	\N
cmq6ahvms00025oig1x5idouv	8f7977e6eabeea2caf3f996b225c30ea2b2a934840a4ae27bfc7491cd24b43ff	cmpp3f50i000l0kigcn8nely8	2026-06-16 06:59:38.211	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-09 06:59:38.212	\N
cmpp6ok6c0004wkigkbrq7t31	7fcb65021cfc9b96d9e33686eb597720d287d415739e3cfb9b31e9e49675befc	cmpp65q9z0002wkiggzquyx9n	2026-06-04 07:40:46.499	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-28 07:40:46.5	\N
cmpp6ovub0005wkig6llumqs9	f294ace37da79c7e685441ebd90924416fd703609f7b397fc7ed6f9045c10d67	cmpp65q9z0002wkiggzquyx9n	2026-06-04 07:41:01.619	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-28 07:41:01.619	\N
cmpp6pein0006wkigt25gnto2	a930e2c1b20efee585ed1f8758d06be2ada7fc0f37200c0ab55bc28f3ec493dc	cmpp65q9z0002wkiggzquyx9n	2026-06-04 07:41:25.823	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-28 07:41:25.823	\N
cmpp6t2m50007wkig2w0kysqc	927285247161774c7e74b2e9d826e453a3b14713e7e98edd2e6f2ec3af4811ba	cmpp65q9z0002wkiggzquyx9n	2026-06-04 07:44:17.021	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-28 07:44:17.021	\N
cmpp6tkyp0008wkigxr7q9vlg	f6bcf7cb43dd04a7534ba055a5104b02c458641039eaeb4f5d1644cbdd2ecc28	cmpp65q9z0002wkiggzquyx9n	2026-06-04 07:44:40.8	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-28 07:44:40.801	\N
cmpp7y6lz0009wkigbwk8fso5	240e02f41f8bf9df6c43a9a39b0b17d61dc9d84c780261e43f381763a4622f52	cmpp65q9z0002wkiggzquyx9n	2026-06-04 08:16:15.094	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-28 08:16:15.095	\N
cmpp8okcu000bwkig0j6fkf0p	4144c8d4a88267f3293c1042c0e8f58e7bc7ebac1d716d066cf6e8ede36ad3e6	cmpp65q9z0002wkiggzquyx9n	2026-06-04 08:36:45.966	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-28 08:36:45.966	\N
cmpqd5zq1001vskigfjn65nl3	601a5045c58e3543f7ba7f454b3078881e3d1de6912d9bb36fabb7b0f4e86d50	cmpp65q9z0002wkiggzquyx9n	2026-06-05 03:30:03.671	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-29 03:30:03.673	\N
cmpqlf8ot00000kigse26frk1	e84c946bea351ce3022cb72524d594b1bba51ff927657ba3ec24adf64fca76ab	cmpp65q9z0002wkiggzquyx9n	2026-06-05 07:21:12.115	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-29 07:21:12.125	\N
cmpqlf8xb00010kig8fsg7r2z	eccc914f0bf04c5a0daea7ff239dbab3b2f1bf1932b5860a1a5a3721c3614212	cmpp65q9z0002wkiggzquyx9n	2026-06-05 07:21:12.43	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-29 07:21:12.431	\N
cmpqlf96n00020kigfatum91b	41f13e633eef0910d8f7f671311727eb542a09f9b8d86b1035bd415af635c291	cmpp65q9z0002wkiggzquyx9n	2026-06-05 07:21:12.767	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-05-29 07:21:12.767	\N
cmpvzah8d0000t8igxas41obq	3ffefbc03bf4b6fe2b562e20c09eb13335e9a45df47954898f8efe83d4eb3145	cmpp65q9z0002wkiggzquyx9n	2026-06-09 01:48:15.413	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-02 01:48:15.422	\N
cmpw13opv0001kgig5nxrbqgv	c5f9bf7581834182fb318f9ffecc39dd5398882ef14d1512d3deb067502c5d4a	cmpp65q9z0002wkiggzquyx9n	2026-06-09 02:38:57.762	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-02 02:38:57.763	\N
cmq4zbe0o000000igragw9oxc	17fe0f841b07afa76ed741b0752fbe3e2dcc7ac62fecd38ec5c11df6023c4cf3	cmpp65q9z0002wkiggzquyx9n	2026-06-15 08:58:53.484	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-08 08:58:53.496	\N
cmq50uajq000100igq7q1s3xn	d2563a25587b4eabbcc637982a2f7efd1204fc7beebfe0735b7f4596cfc5e19c	cmpp65q9z0002wkiggzquyx9n	2026-06-15 09:41:35.076	2026-06-10 06:26:14.583	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-08 09:41:35.078	\N
cmq7tzuq5000amgigvws3lvfn	e51d38ce00d0323d726fb15acb2fa3d72353c3d15567610c797a1f467a04fe0c	cmq7tyuij0006mgigvces5iyb	2026-06-17 08:53:15.723	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-10 08:53:15.725	\N
cmq8x6b9g0000hsigiz152i55	04a1778cb87d5d5600a6dda9564058ececba5eb2382a0695e8e28513394d143b	cmpp3f50i000l0kigcn8nely8	2026-06-18 03:10:02.111	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 03:10:02.116	\N
cmq8yokrk0007hsig493ysprg	254ae5e002e97e539fae2f32c040f71ca9cc41b3f827aa02f5d69353cdd0b604	cmpp3f50i000l0kigcn8nely8	2026-06-18 03:52:13.856	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 03:52:13.856	\N
cmq8yp7dk0009hsigzm5n26m3	824d94bc1e773e2b5e87b7632960da717872ffcec830a6b063c36bf67ad6f0dc	cmpp3f50i000l0kigcn8nely8	2026-06-18 03:52:43.159	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 03:52:43.16	\N
cmq8zr1gt000bhsigidhbz6ku	4fe1da7fa49d4d7d540fdc3e188b5566c0ff006817a556e8648e67debb3e41cc	cmpp3f50i000l0kigcn8nely8	2026-06-18 04:22:08.429	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 04:22:08.429	\N
cmq90sgpo000dhsigmytrrsq4	837727edbd5bac24fe87acc3fc485cc99b9f9776257373d31aaa1f1e80f4f757	cmpp3f50i000l0kigcn8nely8	2026-06-18 04:51:14.46	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 04:51:14.46	\N
cmq96mhs5000mhsigwtbhge8x	637c630c244896ad31b7fd69b3c2294b11c341848aed2a7094111f24ce849437	cmpp3f50i000l0kigcn8nely8	2026-06-18 07:34:33.605	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 07:34:33.605	\N
cmq97mnwt0004a0igpoqs7hnx	4625a2f70b6084e00e4a00319386cd2fa59a5c5740f314ba095e494790dab78a	cmpp3f50i000l0kigcn8nely8	2026-06-18 08:02:41.164	\N	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 08:02:41.165	\N
cmq7uyzuc000bmgigqruwe97c	013b9c5845d25d577623b518656aa0f05872eec05d9e6b1dc100ae9bf187bf92	cmpp65q9z0002wkiggzquyx9n	2026-06-17 09:20:35.316	2026-06-11 15:09:18.988	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-10 09:20:35.316	\N
cmq7uzi0v000cmgig2d6ir6ca	cc27f89c3898d863b6a5cf8c33182cd277bb58cc707b1ba278373fc5ff5e48f7	cmpp65q9z0002wkiggzquyx9n	2026-06-17 09:20:58.877	2026-06-11 15:09:18.988	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-10 09:20:58.879	\N
cmq8wefhj000fmgigk4duneqt	b6bf786987105566294437158b44330719b8e2fd9f31eeb617dd4b8a6f31a5d2	cmpp65q9z0002wkiggzquyx9n	2026-06-18 02:48:21.221	2026-06-11 15:09:18.988	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 02:48:21.223	\N
cmq93jk6m000hhsigd8923t2d	bb864fb6794dc90c9fc50b7de726ae5de69c75d81a040f0ba4bb252bcf8ae1e8	cmpp65q9z0002wkiggzquyx9n	2026-06-18 06:08:17.902	2026-06-11 15:09:18.988	\N	Dart/3.11 (dart:io)	::ffff:192.168.88.55	2026-06-11 06:08:17.902	\N
\.


--
-- Data for Name: Role; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Role" (id, name, description, permissions, "isActive", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmpp3ho1f000o0kigaimf8mnr	Кассчин	\N	{orders.assignable,audit.view,orders.view,orders.create,orders.edit,orders.delete,diagnostics.view,diagnostics.create,diagnostics.edit,diagnostics.delete,customers.view,customers.create,customers.edit,customers.delete,services.view,services.create,services.edit,services.delete,vehicles.view,vehicles.create,vehicles.edit,vehicles.delete,payments.view,payments.create,payments.edit,payments.delete}	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:11:26.067	2026-06-02 03:59:04.949
cmpp3gago000m0kig24uiqlvj	Засварчин	\N	{customers.view,customers.create,customers.edit,customers.delete,vehicles.view,vehicles.create,vehicles.edit,vehicles.delete,services.view,services.create,services.edit,services.delete,diagnostics.view,diagnostics.create,diagnostics.edit,diagnostics.delete,orders.view,orders.create,orders.edit,orders.delete,orders.assignable}	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:10:21.816	2026-06-02 03:59:14.143
cmpyt3jnz000mywigopvd713y	Ажилчин	\N	{customers.view,customers.create,customers.edit,customers.delete,vehicles.view,vehicles.create,vehicles.edit,vehicles.delete,services.view,services.create,services.edit,services.delete,diagnostics.view,diagnostics.create,diagnostics.edit,diagnostics.delete,orders.view,orders.create,orders.edit,orders.delete,payments.view,payments.create,payments.edit,payments.delete,orders.assignable}	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:18:12.815	2026-06-04 01:18:12.815
cmpyt46vs000oywigt4eyowyx	Кассчин	\N	{orders.view,orders.create,orders.edit,orders.delete,payments.view,payments.create,payments.edit,payments.delete,orders.assignable}	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:18:42.904	2026-06-04 01:18:50.419
cmpyt4vts000rywig76go3880	Менежер	\N	{employees.view,employees.create,employees.edit,employees.delete,branches.view,branches.create,branches.edit,branches.delete,customers.view,customers.create,customers.edit,customers.delete,vehicles.view,vehicles.create,vehicles.edit,vehicles.delete,services.view,services.create,services.edit,services.delete,diagnostics.view,diagnostics.create,diagnostics.edit,diagnostics.delete,orders.view,orders.create,orders.edit,orders.delete,payments.view,payments.create,payments.edit,payments.delete,audit.view}	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:19:15.232	2026-06-04 01:19:15.232
\.


--
-- Data for Name: Service; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Service" (id, type, name, code, price, "costPrice", stock, description, "isActive", "tenantId", "createdAt", "updatedAt", "laborCategoryId", "unitId", "durationValue", "durationUnitId") FROM stdin;
cmpp91xdt000eskigq5vadzir	LABOR	Тос солих	\N	50000.00	\N	\N	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 08:47:09.377	2026-05-28 08:47:09.377	cmpp90ph00008skigohfh8dp5	cmpp3f4zi00070kigqbqasxcv	\N	\N
cmpp9bc1s0017skigx87sxubm	LABOR	Naklad solih	\N	20000.00	\N	\N	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 08:54:28.288	2026-05-28 08:54:28.288	cmpp917sl000cskigf5xlf3a7	cmpp3f4zi00060kig96iad8sw	\N	\N
cmpxigumh000r58igdxek9vce	LABOR	Базуур	\N	30000.00	\N	\N	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-06-03 03:32:51.594	2026-06-03 03:32:51.594	cmpp917sl000cskigf5xlf3a7	cmpp3f4zi00040kig0udvcky0	\N	\N
cmpq9kotc001hskigtiya49pg	GOODS	Motor oil	\N	50000.00	40000.00	17.000	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-05-29 01:49:30.913	2026-06-08 03:11:57.402	\N	cmpp3f4zi00040kig0udvcky0	\N	\N
cmq7ehy400002scigwpw2i5e1	LABOR	kolas	\N	34000.00	\N	\N	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-06-10 01:39:26.064	2026-06-10 01:39:26.064	cmpp90xuj000askigd8v7w2pb	cmpp3f4zi00070kigqbqasxcv	30.000	cmpp3f4zi00060kig96iad8sw
cmq4x5cpp0005n8igufebwab8	GOODS	MK Oil	\N	90000.00	50000.00	50.000	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-06-08 07:58:12.637	2026-06-11 14:52:31.888	\N	cmpp3f4zi00040kig0udvcky0	\N	\N
\.


--
-- Data for Name: ServiceItem; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ServiceItem" (id, kind, description, quantity, "unitPrice", total, "orderId", "serviceId", "createdAt") FROM stdin;
cmpp97xvz0013skigc5zvlvn9	LABOR	Тос солих	1.000	50000.00	50000.00	cmpp97sxv0011skigp5jl7f7x	cmpp91xdt000eskigq5vadzir	2026-05-28 08:51:49.967
cmpp9bqll0019skig329a06hb	LABOR	Naklad solih	1.000	20000.00	20000.00	cmpp97sxv0011skigp5jl7f7x	cmpp9bc1s0017skigx87sxubm	2026-05-28 08:54:47.145
cmpq9pl1r001lskig0gclg61j	DIAGNOSTIC	Demo	1.000	0.00	0.00	cmpp9jj8b001fskigltmlizc7	\N	2026-05-29 01:53:19.311
cmpq9qakk001oskiggnac8m2k	DIAGNOSTIC	Undsen	1.000	50000.00	50000.00	cmpp9jj8b001fskigltmlizc7	\N	2026-05-29 01:53:52.388
cmpq9qdjz001qskig2rubag6n	PART	Motor oil	1.000	50000.00	50000.00	cmpp9jj8b001fskigltmlizc7	cmpq9kotc001hskigtiya49pg	2026-05-29 01:53:56.255
cmpxdsfuc000058igd1lne0fp	DIAGNOSTIC	Demo	1.000	0.00	0.00	cmpwagqsx00027wigb955jwg8	\N	2026-06-03 01:21:54.229
cmpxdsjgd000258ig1j294lm1	LABOR	Naklad solih	1.000	20000.00	20000.00	cmpwagqsx00027wigb955jwg8	cmpp9bc1s0017skigx87sxubm	2026-06-03 01:21:58.909
cmpyulfdz002fywigf2k7ngzg	DIAGNOSTIC	jiriin	1.000	15000.00	15000.00	cmpyul7ds002dywigx30lwh7u	\N	2026-06-04 02:00:06.695
cmpz7t9n8000lp4igierx4m8p	DIAGNOSTIC	Undsen	1.000	50000.00	50000.00	cmpz7nytd000fp4igtihkpv2x	\N	2026-06-04 08:10:07.508
cmpz7znsj000np4igt5cybqsa	LABOR	Базуур	1.000	30000.00	30000.00	cmpz7nytd000fp4igtihkpv2x	cmpxigumh000r58igdxek9vce	2026-06-04 08:15:05.779
cmpz8et48000rp4igterbt9el	LABOR	Тос солих	1.000	50000.00	50000.00	cmpxl6vqf001458ignrf46o7s	cmpp91xdt000eskigq5vadzir	2026-06-04 08:26:52.52
cmpz9il4v0013p4ig287mubqe	PART	Motor oil	1.000	50000.00	50000.00	cmpz8gsxp000wp4iginmtpi46	cmpq9kotc001hskigtiya49pg	2026-06-04 08:57:48.415
cmpz9iq4o0016p4igbhgjl1zu	DIAGNOSTIC	Demo	1.000	0.00	0.00	cmpz8gsxp000wp4iginmtpi46	\N	2026-06-04 08:57:54.888
cmpza79iu001dp4igf95w9iwu	LABOR	Naklad solih	1.000	20000.00	20000.00	cmpz8gsxp000wp4iginmtpi46	cmpp9bc1s0017skigx87sxubm	2026-06-04 09:16:59.766
cmq4mwsa00003swiga5775nst	LABOR	Naklad solih	1.000	20000.00	20000.00	cmq4mwh0j0000swig6qpfa2k8	cmpp9bc1s0017skigx87sxubm	2026-06-08 03:11:36.744
cmq4mx87m0007swigcnvud7p0	PART	Motor oil	1.000	50000.00	50000.00	cmq4mwh0j0000swig6qpfa2k8	cmpq9kotc001hskigtiya49pg	2026-06-08 03:11:57.394
cmq9m8vau0005tsigbgq98zri	LABOR	Тос солих	1.000	50000.00	50000.00	cmq9m82sm0002tsigwfsv89bu	cmpp91xdt000eskigq5vadzir	2026-06-11 14:51:51.798
cmq9mgovt000ftsigebzfa2ww	DIAGNOSTIC	ijijj	1.000	250000.00	250000.00	cmq4mwh0j0000swig6qpfa2k8	\N	2026-06-11 14:57:56.729
cmq9mguj4000htsigjjpgo5ho	LABOR	Тос солих	1.000	50000.00	50000.00	cmq4mwh0j0000swig6qpfa2k8	cmpp91xdt000eskigq5vadzir	2026-06-11 14:58:04.048
\.


--
-- Data for Name: ServiceOrder; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."ServiceOrder" (id, number, status, "paymentStatus", "scheduledAt", "startedAt", "completedAt", "paidAt", notes, "totalAmount", "paidAmount", "tenantId", "branchId", "customerId", "vehicleId", "assignedToId", "createdAt", "updatedAt") FROM stdin;
cmpxf9x88000a58ig0lxhiv0x	00005	SCHEDULED	UNPAID	2026-06-03 01:00:00	\N	\N	\N	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmpxf9px0000958iged59vy6g	cmpxf96tw000858ig40s0lvuj	\N	2026-06-03 02:03:29.528	2026-06-03 02:03:29.528
cmpwagqsx00027wigb955jwg8	00004	COMPLETED	PAID	2026-06-02 07:00:00	2026-06-03 01:22:10.128	2026-06-03 02:25:05.691	2026-06-03 01:22:05.721	\N	20000.00	20000.00	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmpp97fuu000xskigwzjjipz4	cmpp97qo0000zskiglwc4hrj5	\N	2026-06-02 07:01:03.538	2026-06-03 02:25:05.695
cmpp9jj8b001fskigltmlizc7	00002	COMPLETED	PAID	2026-05-28 09:00:00	2026-06-03 02:25:16.836	2026-06-03 02:25:17.65	2026-06-03 02:25:15.145	\N	100000.00	100000.00	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmpp97fuu000xskigwzjjipz4	cmpp97qo0000zskiglwc4hrj5	cmpp3f50i000l0kigcn8nely8	2026-05-28 09:00:50.843	2026-06-03 02:25:17.652
cmpp97sxv0011skigp5jl7f7x	00001	COMPLETED	PAID	2026-05-28 08:51:00	2026-06-03 02:25:22.471	2026-06-03 02:25:23.718	2026-06-03 02:25:21.752	\N	70000.00	70000.00	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmpp97fuu000xskigwzjjipz4	cmpp97qo0000zskiglwc4hrj5	cmpp3f50i000l0kigcn8nely8	2026-05-28 08:51:43.555	2026-06-03 02:25:23.719
cmpyul7ds002dywigx30lwh7u	00001	IN_PROGRESS	PAID	\N	2026-06-04 02:02:00.849	\N	2026-06-04 02:01:56.855	\N	15000.00	15000.00	cmpyt2d9g0002ywigy2javyr9	cmpytcl99001tywige6itdj46	cmpyt5n72000tywig3pfooet5	cmpyt612e000wywigarj4u3f8	cmpyt8mkw000zywigszc74hc6	2026-06-04 01:59:56.32	2026-06-04 02:02:06.39
cmpz8gsxp000wp4iginmtpi46	00010	IN_PROGRESS	UNPAID	2026-07-11 02:00:00	2026-06-04 08:28:28.273	\N	\N	\N	70000.00	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmpxjppah000t58igtxlsn98e	cmpz8gpwt000up4igg19yww7z	cmpp3f50i000l0kigcn8nely8	2026-06-04 08:28:25.597	2026-06-04 09:16:59.775
cmpz7nytd000fp4igtihkpv2x	00009	CANCELLED	UNPAID	2026-06-04 01:00:00	2026-06-04 08:06:09.188	\N	\N	\N	80000.00	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmpxjvjl9000v58ig69elnijp	cmpxjx6hh000x58ig023g2vql	cmpp65q9z0002wkiggzquyx9n	2026-06-04 08:06:00.193	2026-06-04 08:25:22.555
cmpyvnlkf002qywigvd5anb4e	00008	IN_PROGRESS	UNPAID	2026-06-04 01:00:00	2026-06-04 08:26:13.776	\N	\N	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmpp97fuu000xskigwzjjipz4	cmpw2vd6k00017gigvupsekga	\N	2026-06-04 02:29:47.631	2026-06-04 08:26:13.778
cmpxl6vqf001458ignrf46o7s	00007	IN_PROGRESS	UNPAID	2026-06-03 01:00:00	2026-06-04 08:26:56.914	\N	\N	\N	50000.00	\N	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	cmpxl64xb001258igrl7xr19y	cmpxl6o6f001358ig1p0a6589	\N	2026-06-03 04:49:05.32	2026-06-04 08:26:56.916
cmpzbub9000022oigyxqtehoe	00011	SCHEDULED	UNPAID	2026-06-04 01:00:00	\N	\N	\N	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmpp97fuu000xskigwzjjipz4	cmpw2vd6k00017gigvupsekga	\N	2026-06-04 10:02:54.708	2026-06-04 10:02:54.708
cmq0981o200032oigxqnfdgmq	00012	IN_PROGRESS	UNPAID	2026-06-05 01:00:00	2026-06-05 01:37:56.42	\N	\N	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmpp97fuu000xskigwzjjipz4	cmpp97qo0000zskiglwc4hrj5	\N	2026-06-05 01:37:22.802	2026-06-05 01:37:56.428
cmq9m82sm0002tsigwfsv89bu	00014	IN_PROGRESS	UNPAID	2026-06-11 01:00:00	2026-06-11 14:52:53.875	\N	\N	bdfb	50000.00	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmpzaydyr001ip4ig626t8g5w	cmpzayfo0001jp4ig58jsxlnd	cmq7rcfh90006lgigsifmc02v	2026-06-11 14:51:14.854	2026-06-11 14:52:53.877
cmq4mwh0j0000swig6qpfa2k8	00013	IN_PROGRESS	UNPAID	2026-06-12 06:00:00	2026-06-08 03:12:00.595	\N	\N	\N	370000.00	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmpzaydyr001ip4ig626t8g5w	cmpzayfo0001jp4ig58jsxlnd	cmpp65q9z0002wkiggzquyx9n	2026-06-08 03:11:22.148	2026-06-11 14:58:04.063
cmq9msl9w000utsigh2bswdtl	00015	SCHEDULED	UNPAID	2026-06-12 08:00:00	\N	\N	\N	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	cmq9mryhz000qtsigbvlytwus	cmq9mryi6000rtsigeoigbxx7	cmq7rcfh90006lgigsifmc02v	2026-06-11 15:07:11.924	2026-06-11 15:07:11.924
\.


--
-- Data for Name: Subscription; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Subscription" (id, plan, status, "startsAt", "endsAt", amount, notes, "cancelledAt", "tenantId", "createdById", "createdAt", "updatedAt") FROM stdin;
cmpyt2da9000cywigjymvguon	FREE	CANCELLED	2026-06-04 01:17:17.887	2026-06-18 01:17:17.887	\N	Бүртгэлийн үед автоматаар үүсгэсэн 14 хоногийн туршилт.	2026-06-04 02:04:39.736	cmpyt2d9g0002ywigy2javyr9	\N	2026-06-04 01:17:17.889	2026-06-04 02:04:39.737
cmpyuto4x002pywignpd0xgj4	BUSINESS	CANCELLED	2026-06-04 00:00:00	2026-06-20 00:00:00	\N	\N	2026-06-04 02:06:40.122	cmpyt2d9g0002ywigy2javyr9	cmpp8w7xt0000k4igk7eg9gvx	2026-06-04 02:06:31.281	2026-06-04 02:06:40.122
cmpp3f4zp000c0kig52f0bk9x	FREE	EXPIRED	2026-05-28 06:09:28.066	2026-06-11 06:09:28.066	\N	Бүртгэлийн үед автоматаар үүсгэсэн 14 хоногийн туршилт.	\N	cmpp3f4zb00020kigzdmly5ii	\N	2026-05-28 06:09:28.069	2026-06-05 07:31:36.599
cmq4ip2qn001fwgighbninq9l	BUSINESS	ACTIVE	2026-06-08 00:00:00	2026-06-30 00:00:00	\N	\N	\N	cmpyt2d9g0002ywigy2javyr9	cmpp8w7xt0000k4igk7eg9gvx	2026-06-08 01:13:38.591	2026-06-08 01:13:38.591
cmq0lvl7g0005i0igdd0kttec	BUSINESS	EXPIRED	2026-06-05 00:00:00	\N	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp8w7xt0000k4igk7eg9gvx	2026-06-05 07:31:36.604	2026-06-09 02:11:18.297
cmq6072xq0003z8igjizz5ye9	BUSINESS	ACTIVE	2026-06-09 00:00:00	2026-06-16 00:00:00	\N	\N	\N	cmpp3f4zb00020kigzdmly5ii	cmpp8w7xt0000k4igk7eg9gvx	2026-06-09 02:11:18.302	2026-06-09 02:11:18.302
\.


--
-- Data for Name: SubscriptionPayment; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SubscriptionPayment" (id, "tenantId", plan, period, amount, currency, "planPriceId", method, status, "qpayInvoiceId", "qpayPaymentId", "qrImage", "qrText", "paidAt", "createdSubscriptionId", "createdAt", "updatedAt") FROM stdin;
cmpp8y0bi0007skigpqgflz92	cmpp3f4zb00020kigzdmly5ii	BUSINESS	MONTH	10.00	MNT	cmpp8x2280000skigg2p6xt8s	QPAY	FAILED	\N	\N	\N	\N	\N	\N	2026-05-28 08:44:06.558	2026-05-28 08:44:06.574
cmpp936lz000gskigqfyx6bjl	cmpp3f4zb00020kigzdmly5ii	BUSINESS	MONTH	10.00	MNT	cmpp8x2280000skigg2p6xt8s	QPAY	CANCELLED	81832b8a-e741-4f2d-869a-24b161ba8ae2	\N	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	0002010102121531279404962794049600260513550406227540014A00000084300010108CAXBMNUB02208gV-AT0kILacFtimpvmD5204737253034965402105802MN5912INFOSISTYEMS6011ULAANBAATAR622407208gV-AT0kILacFtimpvmD7106QPP_QR781553969614456625779022280020263045FA6	\N	\N	2026-05-28 08:48:07.991	2026-05-28 08:48:16.912
cmq0lv4h30004i0ig03mtoahx	cmpp3f4zb00020kigzdmly5ii	ENTERPRISE	YEAR	900.00	MNT	cmpp8xl3s0005skigsqvh94v8	QPAY	CANCELLED	1283006c-609b-492e-b7eb-679111ce081a	\N	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	0002010102121531279404962794049600260610540312527540014A00000084300010108CAXBMNUB0220qcn5Jov7bU7AyeyreTgf52047372530349654039005802MN5912INFOSISTYEMS6011ULAANBAATAR62240720qcn5Jov7bU7AyeyreTgf7106QPP_QR78153147705912553447902228002026304ED11	\N	\N	2026-06-05 07:31:14.919	2026-06-05 07:31:18.49
cmq7i6r8z0008scigtip97w84	cmpyt2d9g0002ywigy2javyr9	ENTERPRISE	YEAR	900.00	MNT	cmpp8xl3s0005skigsqvh94v8	QPAY	PENDING	e95dd177-f7bb-4e52-94e8-df13309b5ff4	\N	iVBORw0KGgoAAAANSUhEUgAAASwAAAEsCAYAAAB5fY51AAAABmJLR0QA/wD/AP+gvaeTAAAd6UlEQVR4nO3daZhUxbkH8H83iw6b7GtghgGDChrNRIiACygBN4yETZ88aK4iBr0oai6QkDzJFa+iIYgxyqKCeoOIghq8osg6ohEQBQVEFITRURbFsAzDMDM99wNRmTPd53R1vVXn1Mz/9zx+cM45VdU9PS/nvF31VqyioqICREQOiIc9ACKidDFgEZEzGLCIyBkMWETkDAYsInIGAxYROYMBi4icwYBFRM5gwCIiZzBgEZEzGLCIyBkMWETkDAYsInIGAxYROYMBi4icUVu3gVgsJjOSNJgu3RX0WiT79/YV1Lbf+UFtqfalSuUzEDS2oPNV+1btT7ItlfdZ9Xeoy3T7Kn2r4B0WETmDAYuInMGARUTO0M5heZnM8wQdV83dmMztSOdWJHMONvNG3nOl+1b9nenklSTzjsmOp3ssnb512fxbUME7LCJyBgMWETmDAYuInCGew/JSfX7VeXaWzmnpjE0352TyfTDd3onn2547J5mnVB27bs5Vpy2vMHNQJn/nvMMiImcwYBGRMxiwiMgZxnNYYZKex+WXm9Gda6KTe9GdNxXUnmT7tuenmVzPp/o+BfWn05ZqX6Zzi6bwDouInMGARUTOYMAiImdUqxyWyXlVXqbX40mOxUs3/yaZs4rS+aZrROnMw7L52Y4y3mERkTMYsIjIGQxYROQM4zksm8/Sputim1z7FdSXzZrbJteOmc69mKwvrzsWv/5M5zx13tco5cN4h0VEzmDAIiJniD8S2nx08bJZItl0eWadxwnbY/NSedSJUllr1bF56Yzd5u8k2fVB50cF77CIyBkMWETkDAYsInJGrCJK31kKM7m8IexnfJX8h5duHkgy9+dluqyKX1+mp57o9CddrtnVP3veYRGRMxiwiMgZDFhE5Azr23yZnP8hvW25Tpli01uy68zDkv4dRKlUjsr50nO+TJaAkc5JmV7G5te2Dt5hEZEzGLCIyBkMWETkDPF5WJI5K92cQphbbEvPAdPZEsr0+yC5XVWYpad1247S+xaleVaSY+MdFhE5gwGLiJzBgEVEzjC+ltDmmjvpGkIqfamSzHHZXgPnZbLOk0pfumML4nIe0uS8Kpu5Yt5hEZEzGLCIyBkMWETkDOvbfEnOyfC2Jb3Vls5YvEzWqLI9Z8dmLXwvyZSrdPpWZ62h7rpFXTZrdengHRYROYMBi4icwYBFRM7QzmFJ50N0mJ4blem5ElyaM2Yzp6Fa+8vk2tWgsfn1p1uDLMx6VpyHRUSUBAMWETmDAYuInKG9ltDkWjHbz846c090cwYm8z6264KZ3AswiMn1otJ5I5NrLsNkci4d77CIyBkMWETkDAYsInKG9jysMOemqOakJPNMkrWQkglzf0bJHIRuHkj6d6wz9ymob8mcV5jrYoNI78+ogndYROQMBiwicgYDFhE5Q7welkt1rk2Snpels85Rt28d0nmiIJJ1xEznKVXGEsTmPphh1u7iHRYROYMBi4icYX2repOPNrpliFWOmyx5nA6Vsfhdm4zk44TpJUxhjs1kaWmbv6OgsejiVvVEVCMxYBGRMxiwiMgZxrf5kty+SjcHJbmkQDpnYDKnYHqsKkyX0Da5XZXOMiBV0lMupNtXaUsS77CIyBkMWETkDAYsInJG6Nt8qbSte73Jbc6D8hsm80TSr1N1LC6N1Y/puUw6c8Js5/5UyvCYzOV58Q6LiJzBgEVEzmDAIiJnhL6W0I90+VzV9lWuDWKzFI50nkhy+ypdkutFpdeDhlm22MvmWG2uq+UdFhE5gwGLiJzBgEVEzhDPYVXpQGOOhulcjMn8WtD5QWNTuT7KeSLpvnTpfN5MrgeNWr7MLw8Z5jpZ3mERkTMYsIjIGQxYROQM42sJw5yHFdSezvmmt4AyWUspiOTvVHqOju78N795WFGqYRbE9Fh09gzw4lpCIqqRGLCIyBkMWETkDOtb1eu0FXada79zTc+L0ak55WUz1+IlXS9eMgcmWd9Kl+la9jpzxFTPZw6LiGokBiwicgYDFhE5w/i+hDp5J93ncpN11nXnm0mPVaUv6fP9rrdZ2z4dkvOwgphcSyh9vZfJvRm4lpCIagQGLCJyBgMWETlDux6W6TpQOmzWMo9yXaega3Xnu0WpbrrNtatRqosuvVbV5mtTwTssInIGAxYROcP4tAYvnccJ1dti3dtalccu6ccwk1MsbJZFkX7cVKXzuBpmORnbpZQkX5vJNA/vsIjIGdbvsMh98XgceXl5yMvLQ7du3aoc//Zf59LSUhw+fBiFhYXYvXs3tm3bFsJoqTqx/i2hzUdCXZI71dh8JFQdq+pHoKioCPXr11e6JpVbbrkFCxYswJ49e9Iam+S30mHPJpfsK0oz5U2+T+IBS/KNNf1LMLm1kvTX1JLBOUqlfr1q1aqFRCKR8rj0EihT1+qyPR3Er3+TuWBVzGFRpGzfvh0333wz6tatG/ZQKIIYsKiSIUOGhNp/Tk4OHn30UWzduhXDhg0LdSwUPQxYBADo2LEjlixZgvnz54c9FODf45k3bx6WLl2KTp06hT0cigjjW9WbZHo5QpTfmigljw8cPIxv/nUQX3+9H6Vl5fhq/0EkEuWol3Uymp7SAHXq1kWL5k3QokUz1IrL/hupk8uJUi7P9hIlV7+c4LSGGiwrKwuzZs1Svu5fBw5h85aP8e7GrXhlxQa8+mHyb/iqqADu+vk5OO/crjir2w/RMae9eACj6o13WD7tRfmt0f0XsFWrVnjppZfQo0ePtK4pLSvDho0f4h+L38Ck+WuUx5tMvx82x43X9sNF55+Lli2aZdQG77CSq653WAxYPu1F+a3R+UBlZ2djxYoVyM3NDTy3tLQUb7y1Hg88sgCvfrg3o7EGqgCmjLoYwwb1R7u2rZQuZcBKjgEr0w4sznUyvZ7P71xpkvOsMvXexg9x95Sn8cKGQpH2AiUq8Ph//RxDBg1Awwb1fE8tLCxEr169sHPnzoy7C7ski82Jp0F9R7nM04kYsDJsrzoHrEOHj2Dm7Odw16zlWu1k6oKcJpg2aRTOPut03/N27NiR1l1iKgxY6Z+vgwErRVsMWMfpjG3nrs9xy7iH8MqWNBPpBs0Z/wtcO/Qy1Klt5rshBqz0z9fBgJWiLQas4zId27r1H+DK0dOwp7g0476lTRzaHePG/goN6vs/ImaCASv983VEKmDprnkzufhZOqlqMoiEvfh01ep1uGj0wxn3adJNfbvgz5NuQ8MG6guuo7TmUud600l5v+ul/050PtucBFPNdezYMfCct95+Fxf9OprBCgBmLv8Id02chsNFR8IeCoWMAauamzFjhu/xDzZvQ6+bpgH2ChFkZObyjzB56myUlpWFPRQKEQNWNTZkyBD069cv5fHde7/CiNumWh2Tjknz1+KZ514JexgUotC3+dJpO0iYEwPDnNgXi8VQu3ZtbNu2LeUjYWlZGcaOn4K/Ldni208Uvfe/E3D2Waelda5kMtlmzSnbCX6//iXzYemc74d3WNXUjTfe6Ju/euW1fCeDFQDc/ofpOHSY+ayaiAGrGorH4xg3blzK43v3fY1hE582OwiDd6+rdnyD5154zVj7FF2s1lANXXnllcjJyUl5fM7fF6GkPHUZYlWDf/wDDBl4Pk7vkovmzZqgSeNGiMfjKDpyFAcOHsTOXYV4e90m3P10Po6UywSyG+5/Ef0v6Yl2bdTWHpLbQl/8rDI5U3oynE4eyXZNdqlJrZ8VfokOl45X6juVMZeeiZHXXYUzTuuMeDz49Rw4eAhLlr2JsfcvQGHRMe3+p9x0Me64dUTSY0uWLEH//v2t1sLXbU+nbd3PvkmicwwZsFKf72LAatWqFXbv3p2ynb9On4sxj+g9TmU3qIvZ992IC3t3TytQee37aj8mT30SUxZt0BoHKoA9y6eiZYumSQ+3adMGX375ZaWfMWAF9y2NSXdKadCgQSmPHTx0GBNnva7Vfu/sxsh/9k/oc0GPjIIVALRo3hT3/vE/Mf32K7TGgtjxGfqpDB48WK99ihwGrGrmiitSB4H1727CwdLMc1c92zfCvBm/RYf2bTNu41t16tTGyF8NxqO3Xa7VzmNzX0d5im3B/N4LcpN20l360Ufq2kyYXPys+3iazjyZeDyOCy+8MGUfS1e9ozTmShIVmDnlNuUCe37isRhuGDEIH+/4HH9ZtDGjNpZ8tA87d36OTrkdqhzr379/lZ+pzH2SfqwK+p3qjEWVK4udvXiHVY3k5eWl3JH5yJFi3Lcg9eNTkDkTBqHraZ01RpdcnTq1Me7269Hy5Mz/7Xx/8zbRMVF0MWBVI3l5eSmP7Sr4AokM/+HLa90Av7jqZ5kPLEDLFk3x1/GZ74e4Zr2bE2BJHQNWNdKtW7eUx7Z/+lnG7d458jI0CChZrOtnF/fESRkm8e9/aUOk6++THO0cls2ver1Mr3Hye22qX9WarF+Uznu2Y1fmddl7nffjjK9NV+NTGuH3v+yNiU+9oXxtRXk59n61H62S7LyzcuVK9OnT5/tzBaeqBI4r4POk0rZqjlN1bH5s55L98A6rhthVkHpulp++nZuhfbs24uNJpmf3MzO+dv83B5L+vHXr1hojoqhhwKohVm3M7JHw4p5nwNY/sNkdMp8uUZyiuF+bNnaCLdnBgFVDrN+6L6PrTs1tJz6WVBo1bJjxtYeKjib9eUONNil6xOdheenkbkzXr1Jtz28OT9D7YLKefFBbiYoK4KTM/m2ymcxu2LA+UIFK1U9vvuQ09Ol9TqXzSkrLMeKe+ZV+dvhIcdI24/G4Um0nHZJ1oWzWbpPuz+TYWa2hBojh+MTPqCsvL69Sqrl3jzMxdNCASj/75sBhwBOwopQYJnP4SFgDxGIxIF4ro2sPH0n+qGXCgQOHqvysfr2Tq/ys5GjVMTVtzEe/mkB8WoOXzf31bFZIkF7GIfHovH//fjRp0iTpOSMu6oSnVm/37SOZjZt2KF+TqcanNMSbs27Hjk8/x3sffIJp//c+WiSpxFBaWnXfxDq1kwfkAwcOoHHjxiLjk/48pXssk7GYXGZkc3szL95hVSOFhannWnVo2zyjNh99bROOFNu5y8rKOhk9e5yDXw6/ElPuGYtj7z6OWCyOt9duwGeff4nS0uM75uzd93WVa1s0T15ixltehtzGHFY1snv37pSz3U87tT2ANcptliYqsGnzNnT/yVkCI1QTj8ex+PW3MGn+8XHXjccwst8ZKCr2FP+rAJo0OSVpG3v27LExVLKEd1jVyLZtqRcB52RnPj1h/ovLMr42XR9s3ob7H5yNzR9+jMS/y8UUFR3BpHnfB9ljiQr87bXNmJP/caVrLz+zdcpdobdu3Wp45GRT5AJWLBZL+z+vioqKSv8FHQ86X2Wcqm0FvRaV1/qtTZs2pewvW6OG1ZR/bMCmLR+ncWZmyhMJzJj9IsY9sRLdhk3C4Osn4rWlq7E8f21an9DLLjo75bFRo0al/Xvx/g5VP386VNsO+vypfr50XqfN9ylyAYsy9847qetdtWvbGpecmlkeCwAmTXkKR0v067Ank//GWvxtyebv/v+FDYUYcMcsDBw3O63rz/5RensUkvsYsKqR9evXo6ioKOmxWAwYflWvjNt+dl0BHpk1Dwnh+Vy7Cgpx3fjH0jo3p2Fd/M9151f6WQxA19NPFR0TRRcDVjWSSCSQn5+f8vj5552T8lg67py5DH9/dpFo0Hrx5RX4rKjyNIUzmmYlPfcPv74ME+68EftWPIgFk36Jvp2a4o/X9sQpjRqIjYeiTTxgqeZ2gvJKKv/p5oVUX0um+a9kr1vq/Jdffjnlsc6dczD83KqlhFWMuHcBHnzkabHHw9Ejh1e6a+rQoC6WPPPfWPPEnbgg5/v5U7XiMVwx4Hj55+bNmmDQwH54df4DuHXU8JRtjxkzxvd36KWaI5XMWwa1pft3pfNaVP/OdP82/Ihv86U6gU2ye92+JSfXSa8d9Lv+xHNbtmyJ3bt3p3wtK/LXoO+tjyiNJZmhP+mA3981At3OUHsc+7xwN/bu+xoNGzbAqZ2yAQBlZWV44KEn8ds5+XjrsbE4r/vxJPrBg4fx2JMLceesZfj7xKG4dqjahhVt27atMg/rxPdRcuJnOnQ+EzY/T97zdf9ORNcpMmClPu4V1Q+Y99zFixdjwIABSc8tKTmGy68Zj2WfVJ18mYk7rjwbw66+GN26/hD1sqouowGA4qMl2LL1EyxanI8/PfP2dz9/+NZLMXrkcMRiQFl5OTa+vxV553Stcv369zbj9C6dUC/JMp1Uli5din79+lX5OQNWetczYKV5PMy+q0vAuvrqq7Fw4cKU569avQ4XjX5YaTxBasdjGN2/K848IxeNGhzPQZUcK8OGTdsxc/H7OFyWfCuu16eNwiV9evq2vXzV21jzzmbcfMMQNGncKK3xDBkyBM8//3yVnzNgpXc9A1aax/3O9dJ9Y3QDmEkqr817LB6PY/v27cjJyUnadll5Ocb85gE8uvRD0TFnokndWnh34d3I6ZB8YuvOXYXoMeQP2Hu0DN3bNsRf/vgf6PVT/5LNBQUFyM3NPV79wSDJP0zp4Cn5j28Qm4Gf3xJWQ4lEApMnT055vHatWhh3+wjUrxX+r/+bY+X43d0zUJSkntXX+/+FW8ZNw96jx9cQrv3iEHrfNA2LFq/0bXPy5MnGgxWFI/xPLBnxxBNP4NNPP015PLtDWzx73/VWx5TK3DW7MHN21ce3JcvexCtbKq8FvKJba/S5oHvKtgoKCvD4448bGSeFjwGrmjp27BgmTJjge86l/S7Avden3inapjtmLMXKN9ZW+tnQQQPw0C3f796c07AuHr5vDBrUT73l2IQJE1BSUmJ0rBQe7RyWdJ7JL9mny2ZSXfd9URmbTu7kSPFR3Pm7BzE9AvmsNlm1sWbBPWj/g+93uikvT2Dm7Ocw+qFXsG7Ob/CTH6feexHC76PKtekIM+muw2Y+LHAsDFipx6LSVpQDVlFRUcot7AHg4KHDGDthKp7I/8R3DDaM6JWL6VPHI+vkk777WSKRwMfbd6HLqR0Dr2fAkhelgMVHwhpg7NixvscbNWyAqfeOxc2XnG5tTKk89eYOPP7kgko/i8fjaQUrqv54h+UzFpW2onyHFYvFMHfuXFxzzTW+fRwpPoqHHp2LCXNW+Z5nwxszxqD3eXnK1/EOS16U7rCMz8MKovuHqHI8SkxP/PNem5WVhVWrVuHcc8/1PTeRqMDi1/MxbPwcFJUnn+xpQ6dGJyH/+Ulo27ql73nr16/H+eefj+Li49MidOavhfn5Md23zrwt3bFJhhg+EtYQxcXFGDhwIHbs8N9UIh6P4fL+F2LzP+7Br0N8RNx+sAQTJ81AScAi64EDB34XrKj64x1WSGzfYX0rOzsbb775Jtq1Cy6ZXF5ejtX/fBd3/+UZsbWHqqbfdjlG3TA05XGdz0iUPj+8w0oPA1ZIwgpY+HfQWr58OXJzc9O6vqTkGP65dgOmz1mEZ9cVpN1vOprVrYWLf9QO833aPbGCgxcDVmbte9XYgFWlA40Phek3yuZCbFU6r93U4tNERQU+2b4Lq//5Hp55aTWWbvsqo3biMWDC4O7oe0Eeuuedhfr162HHzs+wMn8tfvfIYuwprlzQr1vzLCyddw9atWxWpS3JLzekF8NLfsFke/Gz37VeVgscMGClf76K6hiwvG188eVe7CwoxM5dhfjok89R8MVXeDJ/O3Cs7HhUOpbAT7u2RM8z26Njh9bomN0OuR1/gOz2bVGvXvKqokeKj2Ld+g8wb+GySpNZR/bpgof//BvUrVPH97UlG2e65zNgpXetFwNWBuemc73q2HS4FLBuuukmTJ061XdyqYpv29d9D3Z99gVW5K/F5FmvYuv+Ylw3sDfmTBpZ6RwGrPQwYKXbAQNWRmwGrFgshs6dO2PGjBno27dvRuM1qfhoCR5bmI9la7bghQfHVHo9DFjpYcD6tgHhxKVKUjRoLH5tZ3K+ZF+SxyXfp+HDh+Pee+9NWUvLNtOfAZ1rbQZL6b4lk/BB13IeFhkzb948dOnSBaNHj0ZBgew3gkS6eIelcL5kX1G9wzpRrVq1cNVVV2HBggVpnG0G77DM9O3qHRYDlsL5kn25ELBStVdcXIysrOTf8kljwDLTt6sBq7ZuA0GDMZk8Vh2LzV+a6vkm38cgpj6AiUQC8bha1sHkhz2oLy/D30cp9a37vpj8/Kj2pfO+agcsIi+Vb7+IVDDpTkTOYMAiImdoPxJKJ91VrpWcuJfsuE6CVpV0TkznWsnXJv35sJm7U71e8rOu8lnU7VtVmLk/3mERkTMYsIjIGcbXEkqSnicTdL0K6cfXIH7zsIL6tj1WlbZVSc5f85J+37xMriUMc41l0PU6eIdFRM5gwCIiZzBgEZEzjK8lDDrfS2WNnO1pD5J9SV+v0lZQ25Lvm/QyDZtLSlTHYnMZkemlNjq5PpN4h0VEzmDAIiJnMGARkTPEqzXozv/QyX+EOT9Emu2chQqVsUgvvZHMifl99lTb0mW7fIxK+yp/s6ptq+IdFhE5gwGLiJzBgEVEzhDPYdksuWE6zyO5ttBmPXBVJsushD22MHN9JkvhmC5HE6U1lyfiHRYROYMBi4icwYBFRM6wPg/L5POt9HwQyfZMlmsO6iuI9Bo6nT0TVenMyzJdnlmyNpdO25kcV+lb9bgO3mERkTMYsIjIGQxYROQM41vVqz47q8w3Ml0HW6fOkyqTOQXV86VrnKnQXSuocr3tWvc2t8Azfb1O25yHRUQ1AgMWETmDAYuInGG9prtJYdbY1mVzPZaq6rTHneSaTMnfke48KtX2VMej05Yk3mERkTMYsIjIGQxYROQM42sJw6wppTs2lfNN122SzIfonq/zezBdn8rm589LJw9pe91rmHXqdPAOi4icwYBFRM5gwCIiZ4jnsLx0nq2l18ipji1KawlVaimFPYfHZJ0nybphXqq13CRzM9KvS3qfQ5N9qeAdFhE5gwGLiJyhvTQnsAONx5UoLdvwth/lUiTSy19MThVQ7Vv1fMkSyaok30ebpWtMY3kZIqoRGLCIyBkMWETkDO1pDdJLAiSnDpjMgemUek6HzfK5Jr8ytz2lIojOtJkwt6gznduTzK+ZzKfxDouInMGARUTOYMAiImeIb/MVpTIpOn0HtW+yBEs67fvR3VpNdytynXIzpktFS87LMpmrkc5Rmdy63ibeYRGRMxiwiMgZDFhE5Azxbb68JHMSYa/9yvTcTK7XGYuXdOmboPZ1fodhvxaTfeswOR8tWfs6r5XlZYiIGLCIyCUMWETkDONb1duc7yG9Ts3m+iqddW1RWhMX1JfNLaFU249yjbMwmZ4bp4J3WETkDAYsInIGAxYROcP4Nl+669L8hFnzXfW5XreWl9/aMOmcgsm8onQe0WQOzPQ2cypt2c4bndif7tpUL9Z0J6IagQGLiJzBgEVEzjCew/KyufefTt+qpOvPm15TZ6sv6e3fJWt3Se8RoJN3ks4DmZzjZTt3fCLeYRGRMxiwiMgZDFhE5AzttYRhsv2c75dzcGm+kenaXSp9m37fdNiuI6ZybRCTeyvotKWLd1hE5AwGLCJyBgMWETlDex6WzZo+0vvlSeYYpNcSBvXn17ZuTkFyTlnYtcgl3zfdeX8660Ft7rmp2x7XEhIRMWARkUsYsIjIGeJrCcOcB6OSM0jnfEkm59Xovi7pOvyS87JU29bJv0nPEVPJkYZd/8qV/Rp5h0VEzmDAIiJnGC8vY7IURZS2Nbe9BZTN5RCmp2xIUnmsM10SyOQWY7rvuc3yRJJ4h0VEzmDAIiJnMGARkTOsl0g2SffreMnyzX7XqvaVjF8uRjffIb0ERZJkrkd6+odOe7aXCem259c2t6onImLAIiKXMGARkTOczmGZLsnhl6OQnhejw3SpaOmlOzptB5HMQ4a5xCnsuW06n3WWlyEiYsAiIpcwYBGRM4znsGyWbDGd/1A513SOS/J9NbkFme3yzZLrS6U/PyZLBEnPQdRZR2tyXhbvsIjIGQxYROQMBiwicob2VvVR2ubL9po5U23pMj0Wyfyc9LpHk9t8BTE5P013LKr9qczDslnLjXdYROQMBiwicgYDFhE5QzuHRURkC++wiMgZDFhE5AwGLCJyBgMWETmDAYuInMGARUTOYMAiImcwYBGRMxiwiMgZDFhE5AwGLCJyBgMWETmDAYuInMGARUTO+H+jG8qXT0LtHAAAAABJRU5ErkJggg==	0002010102121531279404962794049600260611140242727540014A00000084300010108CAXBMNUB02204Mg9YZCpTd0ox7l85Zu552047372530349654039005802MN5912INFOSISTYEMS6011ULAANBAATAR622407204Mg9YZCpTd0ox7l85Zu57106QPP_QR78154253240635556467902228002026304A0F2	\N	\N	2026-06-10 03:22:42.42	2026-06-10 03:22:43.293
\.


--
-- Data for Name: SuperAdmin; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."SuperAdmin" (id, email, "firstName", "lastName", "passwordHash", "createdAt", "updatedAt") FROM stdin;
cmpp8w7xt0000k4igk7eg9gvx	root@carcare.mn	Бат	Болд	$2b$12$4c6/gF5WyMevljqQ.oeKWuLT65u2DfqZPGbFuKPe.QTPB/nbBMYHW	2026-05-28 08:42:43.121	2026-05-28 08:42:43.121
\.


--
-- Data for Name: Tenant; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Tenant" (id, slug, name, "registerNumber", email, phone1, phone2, "logoUrl", plan, suspended, "createdAt", "updatedAt", "acceptsOnlineBooking") FROM stdin;
cmpyt2d9g0002ywigy2javyr9	f3119a	Боржигон Автосервис	1234567	bathuleg@contact.mn	88005520	88005521	\N	BUSINESS	f	2026-06-04 01:17:17.86	2026-06-08 01:13:38.597	f
cmpp3f4zb00020kigzdmly5ii	bbc496	Инфосистемс	2565439	contact@info.mn	70116543	\N	\N	BUSINESS	f	2026-05-28 06:09:28.055	2026-06-09 02:11:18.311	t
\.


--
-- Data for Name: TenantQPaySettings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."TenantQPaySettings" (id, "tenantId", username, password, "invoiceCode", "callbackUrl", enabled, "accessToken", "refreshToken", "tokenExpiresAt", "refreshTokenExpiresAt", "createdAt", "updatedAt") FROM stdin;
cmpp973oy000vskigws3191lf	cmpp3f4zb00020kigzdmly5ii	INFOSYSTEMS	ZxZIolYq	INFOSYSTEMS_INVOICE	https://merchant.qpay.mn/v2/	t	enc:v1:hPEHxNEjxfXEK07BRF1Q2Q6BZc5OyJsFWYOE6dKef1WvJBnBp6UhB75CBqMhgFVlNssSsx1vR9peW3YTnIQZdPGrlvr1UtykAQNNVRjOup2FsFaYYRnDNEyFs91/iwdJ9EawDwCY3QHygDwaHFkWXYyRRB2G+x831nVKk527kZITCCC0rpsuWg5UA/RZDLWt25//mm25keG0ZkO0rcyQ04SddTaEO0GkCATCvtM2Jye0XKOoXUuzGj+qIVCPfvbOLKIoonkWLZaX2AtZWkp0jTJ4Q21c7NGqoamTYGuiYr44bZmZp5FbJlpKZWzCZ/erXdahgway1e26YoBfisjg19oeD5ILuwK+qozg4+bFl4LazTJ4mB2WaGUfcQWJ+Mq0SeRzFMxTMpKxNQVZlmrW+40OHXHf9vM/xEbacItano+WTldO5PO4Tg73++HX1if9e4NzQ1rVg8Eylci7hQ50Mct2Qq4LUUQx6U/O8+7hVwe+zppsUakyhuJk0fJ/AoFG3/a88T/DrAg=	enc:v1:bslJis6btv8bXDqWgs0wgoK4iFsQl4+MaVHg2EGPDa+lVweh6U4PHk+Y+us6X/1wiydnZbn9AT+QL981QuUaLoiHddaNwOkvVbEHEHKV42gjyeZ6Uzn2JCDRVIKwNcX+6BQp46EGyeiOrJ+15JnSTObXycsjWGtr35bdkI6MD8sqQH22Y5XDVQs7c+q5u3k1xt6dn2F6GZqul+ldekAj7YvaAoeQUYe3jsgSonXXbcx3yM8lwf2cT8vE605ChHKvUm0RlQr8DPkvuIgusj3E62+LhdxbMDhq4uzOF5PKPEe+mppER4chsfUormtmyyktneufYniDxjOoWKDJCYWxVUMzu1J1XCjWH8Lwz8KDYxGN8Tn9j5q0w1/AKcBQxQSvAsMd4tGKxxcnjOFjn3vXGxxWSWzscqxltiQtddLg3WrbG0EMPiHFwxI7pQKz86/I	2026-06-12 07:39:25	2026-06-12 07:39:25	2026-05-28 08:51:10.834	2026-06-11 07:38:54.98
\.


--
-- Data for Name: Unit; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Unit" (id, name, code, "isActive", "tenantId", "createdAt", "updatedAt") FROM stdin;
cmpp3f4zi00030kigus9y50zd	хүн/цаг	х/ц	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpp3f4zi00040kig0udvcky0	ширхэг	ш	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpp3f4zi00050kigl0geycxk	цаг	ц	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpp3f4zi00060kig96iad8sw	мин	мин	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpp3f4zi00070kigqbqasxcv	литр	л	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpp3f4zi00080kigvxmu1b3v	кг	кг	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpp3f4zi00090kigd4frpb2i	м	м	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpp3f4zi000a0kiggwxedv2w	удаа	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpp3f4zi000b0kigqc0qjfs0	багц	\N	t	cmpp3f4zb00020kigzdmly5ii	2026-05-28 06:09:28.062	2026-05-28 06:09:28.062
cmpyt2d9v0003ywig3s0suglu	хүн/цаг	х/ц	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
cmpyt2d9v0004ywigeturfyl0	ширхэг	ш	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
cmpyt2d9v0005ywigcsnesiic	цаг	ц	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
cmpyt2d9v0006ywigaqn4czz2	мин	мин	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
cmpyt2d9v0007ywigy0zyi9y4	литр	л	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
cmpyt2d9v0008ywignzh6h94v	кг	кг	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
cmpyt2d9v0009ywig9i0b1ojs	м	м	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
cmpyt2d9v000aywigx29x82lw	удаа	\N	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
cmpyt2d9v000bywig2zourj00	багц	\N	t	cmpyt2d9g0002ywigy2javyr9	2026-06-04 01:17:17.875	2026-06-04 01:17:17.875
\.


--
-- Data for Name: User; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."User" (id, email, "firstName", "lastName", phone, "passwordHash", "tenantId", "branchId", "createdAt", "updatedAt", "failedLoginAttempts", "lockedAt", "activeUntil", "isActive", "isOwner", "roleId", verified) FROM stdin;
cmq7tyuij0006mgigvces5iyb	bambar@gmail.com	Бамбар	Бар	70133431	$2b$12$/Ci4PRCmAtuUYPU3WWOK..WwdoYhrqMfv0BYzbg/mYH..PuwXKcHG	cmpyt2d9g0002ywigy2javyr9	cmpytbgrp0014ywigy6zb3nio	2026-06-10 08:52:28.795	2026-06-10 08:53:15.705	0	\N	\N	t	f	cmpyt4vts000rywig76go3880	t
cmpp65q9z0002wkiggzquyx9n	act@a.mn	Myagmardorj	Naimanjin	99915431	$2b$12$xUJSwSpgvOHpZ7lMUBt8FeU1g1yVZefO/TWsdbEUCsL4xYZGEldhe	cmpp3f4zb00020kigzdmly5ii	cmpxovzbe001558igh6sqsct4	2026-05-28 07:26:07.943	2026-06-11 15:09:18.984	0	\N	\N	t	f	cmpp3gago000m0kig24uiqlvj	t
cmpyt8mkw000zywigszc74hc6	boorchi@a.mn	Боорчи	Мухулай	80005000	$2b$12$.PWeOS4.uJ1hv4V/YDIVauWTFNWfVvrMieK3usVWiCMbqomXcdi56	cmpyt2d9g0002ywigy2javyr9	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:22:09.872	2026-06-04 01:22:09.872	0	\N	\N	t	f	cmpyt3jnz000mywigopvd713y	t
cmpyt9to40011ywigndf10fj0	amurun@a.mn	Ангарагмөрөн	Сартуул	50556251	$2b$12$NPfJkPCBi2Q9xNZqUZW10.qHOgrSbNw4Afw/3g5shM7ea4cNwp5QC	cmpyt2d9g0002ywigy2javyr9	\N	2026-06-04 01:23:05.716	2026-06-04 01:23:05.716	0	\N	\N	t	f	cmpyt4vts000rywig76go3880	t
cmpyt2dap000lywigv9rpp34j	uguudei@a.mn	Өгөөдэй	Уйгаржин	95113663	$2b$12$B3NiVC4xuXIz01yLgVqgwu39mlClEGG9xHnIHxP4GFc30i8o1Mg7y	cmpyt2d9g0002ywigy2javyr9	cmpyt2dag000dywig1wufz5r1	2026-06-04 01:17:17.906	2026-06-08 07:14:10.877	0	\N	\N	t	t	\N	t
cmpp3f50i000l0kigcn8nely8	jijgee647@gmail.com	Director	Zahiral	95733832	$2b$12$SCRixWT/Y9Rlh3oi8C60I.RAce7kBtieowPBQ59WSoj1GSj7jlMb2	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	2026-05-28 06:09:28.098	2026-06-10 01:23:35.132	0	\N	\N	t	t	\N	t
cmq7rcfh90006lgigsifmc02v	enhjino@gmail.com	Enhjin	Erhembayr	95383832	$2b$12$Xf9xvbYpeGB4C937AHW42Oi07mDc/pxfiCTtHUawnkZwhhpArGLD6	cmpp3f4zb00020kigzdmly5ii	cmpp3f4zw000d0kiggeq0lcat	2026-06-10 07:39:03.645	2026-06-10 08:10:04.68	0	\N	\N	t	f	cmpp3ho1f000o0kigaimf8mnr	t
\.


--
-- Data for Name: UserSession; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."UserSession" (id, "userId", "userAgent", ip, "createdAt", "lastSeenAt", "expiresAt", "revokedAt") FROM stdin;
cmq9mvj7w000ztsig2s8t5l5c	cmpp65q9z0002wkiggzquyx9n	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.39	2026-06-11 15:09:29.228	2026-06-11 15:21:39.746	2026-07-11 15:09:29.227	\N
cmqj8u1m90000x8igav978gd0	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-18 08:34:06.897	2026-06-18 08:34:06.897	2026-07-18 08:34:06.888	2026-06-18 08:38:31.765
cmq7sgbh90002mgigckkcdw47	cmq7rcfh90006lgigsifmc02v	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-10 08:10:04.701	2026-06-10 08:36:20.394	2026-07-10 08:10:04.7	\N
cmq5zc6xl0001z8igseqxfp4e	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.114	2026-06-09 01:47:17.145	2026-06-09 06:47:36.198	2026-07-09 01:47:17.144	\N
cmq7oqw2y000170igo709hili	cmpp65q9z0002wkiggzquyx9n	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-10 06:26:19.498	2026-06-10 07:17:52.706	2026-07-10 06:26:19.496	2026-06-10 07:21:28.42
cmq4kgjmp0001ukign215mdch	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	::ffff:192.168.88.114	2026-06-08 02:02:59.809	2026-06-08 02:47:58.013	2026-07-08 02:02:59.809	2026-06-08 02:48:07.692
cmq6ecuqn00005cig5hfs51zw	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.114	2026-06-09 08:47:42.239	2026-06-09 10:32:01.295	2026-07-09 08:47:42.233	\N
cmq4wy9st0003n8igx8bwoagt	cmpp65q9z0002wkiggzquyx9n	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	::ffff:192.168.88.114	2026-06-08 07:52:42.269	2026-06-09 01:47:13.372	2026-07-08 07:52:42.268	2026-06-09 01:47:13.378
cmqqb0j5r0000hsigsfipk2jg	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.114	2026-06-23 07:09:32.031	2026-06-23 08:07:11.773	2026-07-23 07:09:32.024	2026-06-23 08:07:17.026
cmq7qt3iv0001lgig7k3z2ccc	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-10 07:24:01.687	2026-06-10 07:34:29.324	2026-07-10 07:24:01.685	2026-06-10 07:37:38.508
cmq4m2o520001j0igg1qj93mx	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	::ffff:192.168.88.114	2026-06-08 02:48:11.702	2026-06-08 06:04:09.951	2026-07-08 02:48:11.7	2026-06-08 06:04:16.419
cmq7i5uht0006scig49chhx4t	cmpyt2dap000lywigv9rpp34j	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-10 03:21:59.969	2026-06-10 06:24:01.492	2026-07-10 03:21:59.969	2026-06-10 06:24:34.278
cmq4wj0nu0000n8igdlkrarhg	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	::ffff:192.168.88.114	2026-06-08 07:40:50.586	2026-06-08 07:40:50.586	2026-07-08 07:40:50.581	2026-06-08 07:41:51.949
cmq4vkqbt00000wigk29nv0r7	cmpyt2dap000lywigv9rpp34j	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-08 07:14:10.889	2026-06-09 02:57:29.966	2026-07-08 07:14:10.882	2026-06-09 02:57:32.544
cmq969t9r000khsig8kw257nq	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-11 07:24:41.967	2026-06-11 08:45:05.31	2026-07-11 07:24:41.966	\N
cmq90xruc000fhsigmxgj3xkf	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-11 04:55:22.164	2026-06-11 07:23:52.82	2026-07-11 04:55:22.162	2026-06-11 07:24:07.112
cmq7txu640004mgigy860x9a3	cmpyt2dap000lywigv9rpp34j	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-10 08:51:41.693	2026-06-10 10:52:35.263	2026-07-10 08:51:41.692	\N
cmq7razrq0004lgigm88jsp1r	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-10 07:37:56.63	2026-06-10 08:05:47.677	2026-07-10 07:37:56.63	2026-06-10 08:09:13.448
cmq7dxke00000scig2clrqaab	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.114	2026-06-10 01:23:35.16	2026-06-10 06:37:15.516	2026-07-10 01:23:35.154	\N
cmqj9119e0003x8ig4ul67vwa	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-18 08:39:33.026	2026-06-18 09:00:55.02	2026-07-18 08:39:33.025	\N
cmq9m1l0i0000tsigdstbmb0f	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.39	2026-06-11 14:46:11.874	2026-06-11 15:06:14.542	2026-07-11 14:46:11.866	2026-06-11 15:07:34.025
cmq8utqky000dmgigdqithnk5	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::ffff:192.168.88.55	2026-06-11 02:04:16.211	2026-06-11 03:10:10.763	2026-07-11 02:04:16.209	2026-06-11 03:10:13.116
cmqkdf8zg0000dcigf7x7a3ph	cmpp3f50i000l0kigcn8nely8	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36	::1	2026-06-19 03:30:20.86	2026-06-19 03:45:00.535	2026-07-19 03:30:20.851	\N
\.


--
-- Data for Name: Vehicle; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public."Vehicle" (id, plate, vin, make, model, year, mileage, "tenantId", "customerId", "createdAt", "updatedAt", "fuelType", "wheelPosition") FROM stdin;
cmpp97qo0000zskiglwc4hrj5	8292УАС	ZVW413216175	Toyota	Prius Alpha	2012	\N	cmpp3f4zb00020kigzdmly5ii	cmpp97fuu000xskigwzjjipz4	2026-05-28 08:51:40.609	2026-05-28 08:51:40.609	Бензин - Цахилгаан	Баруун
cmpw2vd6k00017gigvupsekga	8292УАА	NZE1647026346	Toyota	Corolla Axio	2014	\N	cmpp3f4zb00020kigzdmly5ii	cmpp97fuu000xskigwzjjipz4	2026-06-02 03:28:28.796	2026-06-02 03:28:28.796	Бензин	Баруун
cmpxf96tw000858ig40s0lvuj	0099УАК	JTMABABJ204032788	Toyota	Land Cruiser	2022	\N	cmpp3f4zb00020kigzdmly5ii	cmpxf9px0000958iged59vy6g	2026-06-03 02:02:55.316	2026-06-03 02:26:42.148	Бензин	Зүүн
cmpxjx6hh000x58ig023g2vql	1111УАА	JTMAUCBJ004054469	Toyota	Land Cruiser	2024	\N	cmpp3f4zb00020kigzdmly5ii	cmpxjvjl9000v58ig69elnijp	2026-06-03 04:13:33.077	2026-06-03 04:13:33.077	Бензин	Зүүн
cmpxl6o6f001358ig1p0a6589	8888УКУ	\N	Rollsroyce	Cullinan	2024	\N	cmpp3f4zb00020kigzdmly5ii	cmpxl64xb001258igrl7xr19y	2026-06-03 04:48:55.527	2026-06-03 04:48:55.527	\N	\N
cmpyt612e000wywigarj4u3f8	7548УЕК	JTMHV05J705023106	Toyota	Land Cruiser	2011	\N	cmpyt2d9g0002ywigy2javyr9	cmpyt5n72000tywig3pfooet5	2026-06-04 01:20:08.678	2026-06-04 01:20:08.678	Дизель	Зүүн
cmpz8gpwt000up4igg19yww7z	1234УНЦ	LC0FD1C40R5285646	BYD	QCJ2030ST6HEV1	2024	\N	cmpp3f4zb00020kigzdmly5ii	cmpxjppah000t58igtxlsn98e	2026-06-04 08:28:21.677	2026-06-04 08:28:21.677	Бензин - Цахилгаан	Зүүн
cmpzamn8x001hp4igsi3zvd19	0011УАУ	\N	BYD	Tang	2024	\N	cmpp3f4zb00020kigzdmly5ii	cmpzamlob001gp4iglhbbals7	2026-06-04 09:28:57.393	2026-06-04 09:28:57.393	\N	\N
cmpzayfo0001jp4ig58jsxlnd	1111УКА	\N	LEXUS	LX 600	2024	\N	cmpp3f4zb00020kigzdmly5ii	cmpzaydyr001ip4ig626t8g5w	2026-06-04 09:38:07.44	2026-06-04 09:38:07.44	\N	\N
cmq0w9rse0019wgigxs5dm7rb	0839ХӨН	TRJ1500047911	Toyota	Land Cruiser Prado	2014	\N	cmpp3f4zb00020kigzdmly5ii	\N	2026-06-05 12:22:34.478	2026-06-05 12:22:34.478	Бензин	Баруун
cmq9mryi6000rtsigeoigbxx7	1122УАН	GYL152001581	LEXUS	RX450h	2009	\N	cmpp3f4zb00020kigzdmly5ii	cmq9mryhz000qtsigbvlytwus	2026-06-11 15:06:42.414	2026-06-11 15:06:42.414	Бензин - Hybrid	Баруун
\.


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
0465f2cb-309e-438f-8ea8-cb0f545990e9	f8ce5af8bbb1a639ed36d9225d89490c920bf9d08a1ff0ddbbc58ec47a1d9684	2026-05-28 12:49:49.036378+08	20260528044948_add_role_model	\N	\N	2026-05-28 12:49:48.983051+08	1
2f5c25b4-98a8-4dac-bf2a-1fdf3a608052	915cd10d19053f15f3723becd5bfdf15e9e04abc407d302b2f4b8d65a5636c4f	2026-05-28 12:48:38.18552+08	20260525013328_init	\N	\N	2026-05-28 12:48:37.919478+08	1
adedbd60-28f8-4ba1-944c-a9d07de57cff	e7430990e3ecab18a85d11205004b2174fdf11e7ca47cba5930fca959fa66d74	2026-05-28 12:48:38.385161+08	20260526071841_add_plan_feature	\N	\N	2026-05-28 12:48:38.372374+08	1
17c56a7e-733a-43c5-84b2-cf164ebca1f9	423b3bf10e105ac9186e8c58a84be128a1d1878ffbee5c31a9e7959f0f710be7	2026-05-28 12:48:38.217134+08	20260525022342_add_labor_category	\N	\N	2026-05-28 12:48:38.186184+08	1
524150a5-3d59-4c96-b666-6e2a888fffe0	bff3d50e20b442e11cf6b6cab638c47e26b90653f3c2d976a25f330bd9fc6304	2026-05-28 12:48:38.235063+08	20260525025815_service_unit_refs	\N	\N	2026-05-28 12:48:38.217783+08	1
c1c4651a-c7ff-402d-b35c-5bd0f9c53914	3a9e8b488d5cf76f9f3552e1aeda95832f9ac27a08d6ccc19238aafb48f3dadb	2026-05-28 12:48:38.237348+08	20260525032748_vehicle_fueltype_wheelpos	\N	\N	2026-05-28 12:48:38.235613+08	1
ddaa903b-2846-434b-8a65-92ab2af18aa5	d409c1940f23f7ec92d9f54d6a7119247095a91b43599121ec2b62141c7daea9	2026-05-28 12:48:38.388418+08	20260526121830_backfill_tenant_subscription	\N	\N	2026-05-28 12:48:38.385807+08	1
22f042eb-f612-483a-b516-3a9c5292ab37	b66eecb7338882be41a94c10d82655e79c242acb4d6071ce4caa1f30c2ff04d7	2026-05-28 12:48:38.239319+08	20260525045816_add_engineer_role	\N	\N	2026-05-28 12:48:38.237851+08	1
8fdcad72-34a7-4cb3-bf53-7bf7d38bf31f	377b393e9eb7263c8fdc08888f6c8740d539770bf5684535a7c24af258a0d92e	2026-05-28 12:48:38.241276+08	20260525060656_add_accountant_role	\N	\N	2026-05-28 12:48:38.239811+08	1
ab8902e1-b931-4a22-8009-c9896c623814	2a4d3ec8636c51ac2f39156c07ae8f091fc73219b7d215591c290be62cff0f0b	2026-05-28 12:48:38.264879+08	20260525082638_add_refresh_token	\N	\N	2026-05-28 12:48:38.24176+08	1
0bff641e-18af-4a66-a5dc-84102f137f7e	97cc0b9ec812dc645308c961a20a144df9f8b4d2a0000696b49e7a62fe29a9ae	2026-05-28 12:48:38.392853+08	20260526161007_seed_plan_features	\N	\N	2026-05-28 12:48:38.388938+08	1
3cfdcadc-7f07-4916-be65-25115f1696de	0ab6979aaf8706fba303d320f709f3891452dab5d6def7300553ce93deda7621	2026-05-28 12:48:38.285348+08	20260525084404_add_otp	\N	\N	2026-05-28 12:48:38.265753+08	1
ccc71422-0def-4e1b-961c-68f47f2b4656	2974846f8c4cf09f417e34da5ce6ddb3ae2040c0d20d150674c7c0deff9f8b3b	2026-05-28 12:48:38.287822+08	20260525111019_seed_man_hour_unit	\N	\N	2026-05-28 12:48:38.28597+08	1
eece23e4-8c86-4bdb-add3-30e92921342b	5daebd92f7506dc28dcf4466445abb36d3d0eef0fda32f1d77877254b00bb5fc	2026-06-04 15:46:41.177749+08	20260604074641_add_order_diagnostic_plan	\N	\N	2026-06-04 15:46:41.133851+08	1
4357f5ab-387b-4339-a342-3d0cea71ce14	7a4b27c37e88268306e7f19ef6a747d608091fc67c3bbd08081c49743d819b6d	2026-05-28 12:48:38.316757+08	20260526034641_add_subscription	\N	\N	2026-05-28 12:48:38.288362+08	1
cfee8062-e529-43e2-83ff-1fc961437a82	3dc7742184c61fa54e22b2e1bf68b14899abc91743b857ee6ec071bff0e26d7e	2026-05-28 12:48:38.412587+08	20260527021418_add_branch_schedule	\N	\N	2026-05-28 12:48:38.393431+08	1
53b66170-14e3-4593-abe0-493e29412ca8	7a2e71142bcd827b471270ded659fc7f5d9f11fc0f4a075c414e73e7dbf5182c	2026-05-28 12:48:38.320078+08	20260526042910_user_login_lock	\N	\N	2026-05-28 12:48:38.317351+08	1
c3e6ac13-642e-42cf-9320-8414ff061a10	d2bf9f51db8aaafaff9b1c5efa08ef71032ba363691aac4959ff8c9d6c9ab058	2026-05-28 12:48:38.337259+08	20260526063009_add_plan_price	\N	\N	2026-05-28 12:48:38.320644+08	1
64413ee9-13a3-421a-b4f9-0632d926fc89	da400ed9e520f4563a1c1e35fe0dc334dff0475855b818a5f3cb8183503a45f9	2026-05-28 12:48:38.371786+08	20260526064541_add_qpay_payments	\N	\N	2026-05-28 12:48:38.338066+08	1
37465704-845e-490b-b2cd-7de39d88e2af	361e34f26b21fae5342425c6382ec2af8a0445ba0f05ab5b5a910f5455d9ceaf	2026-05-28 12:48:38.450854+08	20260527022449_add_audit_log	\N	\N	2026-05-28 12:48:38.413466+08	1
013f6b7a-6b32-4ed5-9292-227ce398909b	8486340c44817b8153c41b7f230144f0b71c0a7c906488d8767bd5a086908ff5	2026-06-05 16:09:20.548768+08	20260605080916_branch_slot_config	\N	\N	2026-06-05 16:09:20.526825+08	1
e43e26d4-0c01-4f04-bfb9-98a6d541f117	d0bbdcb099c4a2dd0e2a707de70f2d652e86d4188c076561663c85e1bda699c5	2026-05-28 12:48:38.469304+08	20260527072724_add_plan_limits	\N	\N	2026-05-28 12:48:38.451478+08	1
6c8df2e9-c803-4252-85c0-235168376744	7da5cce5f57fc75c2f9e4b8580647afed01c3ea6da745ab4f101357a45de7420	2026-06-05 11:55:15.886874+08	20260605035456_add_account_and_phone_otp	\N	\N	2026-06-05 11:55:15.837172+08	1
8163c9cc-5ad1-4857-bfa7-fe33d4227127	187f5dadc07e3e5f07f2be2ad0057a91308f41e8b4b99fd0b7ef374dc4f88ba3	2026-05-28 12:48:38.479735+08	20260527075852_user_active_status	\N	\N	2026-05-28 12:48:38.470103+08	1
82025d18-7481-45d3-b8c0-83fe0cad2aed	fbb377de0c23b1d1e6fde119eb9f20be667b54dc7e461f37971c214720ae0703	2026-05-28 12:48:38.519282+08	20260527083910_tenant_qpay_and_order_payment	\N	\N	2026-05-28 12:48:38.480731+08	1
b199240b-a979-42e1-8d2b-8bdbdd8cb44b	9e0d22550b8a981abc226d11cb63c050464882691f99bb328b3eb80fcb92e0a0	2026-06-05 14:10:11.279726+08	20260605060950_add_account_vehicle	\N	\N	2026-06-05 14:10:11.213241+08	1
8109e731-42ca-408f-8d5d-09e772498d7e	1cdfe6acf7779e4435bbe7202e3217d684a88a9203e24ec07381f7802ba1f8ab	2026-06-05 12:20:40.013984+08	20260605042019_add_appointment	\N	\N	2026-06-05 12:20:39.940716+08	1
6bf412ba-8436-49be-93df-b0036cd55dcb	560d2efeef98d4e9008877ad42328a1efeb06bf9dea2e7a0d5f082e4f2e190bb	2026-06-05 12:32:38.514936+08	20260605043221_appointment_account_nullable	\N	\N	2026-06-05 12:32:38.47443+08	1
25378b03-48a9-4c0a-b59a-6608030b9846	bbd4da8602e680a29c04a268565cc4df60c359e65ca3525f976e5bba782f7100	2026-06-05 14:45:11.664449+08	20260605064456_appointment_reminder_sent	\N	\N	2026-06-05 14:45:11.631165+08	1
0314973c-0625-4f0f-b5aa-8dcdba925a9c	f698d350673340abdb78bbd2c6981f42f291d8a2ed0af8210af634b0644b4f10	2026-06-05 12:50:58.407902+08	20260605045044_tenant_accepts_online_booking	\N	\N	2026-06-05 12:50:58.38308+08	1
c8ca6f13-dfc2-4cdb-a2a1-b7908e4de1d0	e24449c87599edc0df800032e9a13a7fd4ec4b17cbe3ac85b7123a0fe2d36835	2026-06-05 15:09:44.260977+08	20260605070934_account_vehicle_wheel_position	\N	\N	2026-06-05 15:09:44.242272+08	1
735cf462-d793-42cf-b8fa-6487934ddaff	2b9d28eb00f6425fdbcc04e7f9199b25ebc69ab96b1ca38fb5fa89ee8263b6b0	2026-06-09 10:41:48.787309+08	20260609024122_notification_center	\N	\N	2026-06-09 10:41:48.733805+08	1
cc044295-d34b-4a6a-b72d-46a85c44af60	910403034670b4f8284ef56ffedefb77790be38e5484d042f40dde9016e0176b	2026-06-08 09:50:39.349199+08	20260608015035_user_session	\N	\N	2026-06-08 09:50:39.286062+08	1
43d3953b-3d11-4604-af98-2d47fd80c749	c7686ab32e01f2ab6de8d5bf6cfd64f1ec21b798e005a052d21c15434693d746	2026-06-08 14:26:06.309271+08	20260608062601_platform_setting	\N	\N	2026-06-08 14:26:06.273983+08	1
ffbe2d0e-6cc8-4b08-9aa8-025b1b9ea3db	81ca349b0663c52aeddfd5119bfd455fd2c7831d0c6f3b306a47a731d90c656f	2026-06-08 10:14:02.242727+08	20260608021352_add_device	\N	\N	2026-06-08 10:14:02.166817+08	1
a0211a72-9f24-430a-950b-54fdb6031f06	135db19491e5e876555b7a2cd2ee0aa67b7bb296bea0769239b66e4164a802ff	2026-06-10 12:35:46.530842+08	20260610043546_staff_verified_optional_password	\N	\N	2026-06-10 12:35:46.517068+08	1
22b47cf7-54ff-44fd-9251-a4351acb8190	fea76a59688f411b20fe33cddd016941d320e214d4f15a412b5da8c38ff9388a	2026-06-10 12:37:34.640366+08	20260610043629_backfill_existing_users_verified	\N	\N	2026-06-10 12:37:34.636958+08	1
7f7a1f8d-2fd8-4991-bc02-df7dbed37dce	4ded3600dce60c31c5ffa80d08b937237894466493198ff932bbcdb6f6c2c938	2026-06-10 14:44:58.290776+08	20260610050000_user_phone_unique	\N	\N	2026-06-10 14:44:58.277989+08	1
41618d9a-e3b2-4925-b776-5c64fe4269f2	204f4353bde3168e74d6129bc7507f0e21a470c0fb354bf8f5ab0062d27f9e3d	2026-06-10 15:19:55.147747+08	20260610051000_tenant_name_unique	\N	\N	2026-06-10 15:19:55.138263+08	1
08181ee5-aed0-40b8-9ae7-9251c8061dda	08b23619ce3005dcb8131fae6284bb4e943ebb00870be1c92eb9b02ac9ae019d	2026-06-11 16:48:20.678434+08	20260611000000_add_qpay_urls_to_order_payment	\N	\N	2026-06-11 16:48:20.658107+08	1
180e43f4-68a5-49e7-97f8-d9729ad6e839	dcc01b179aeb95fef077d5aeb6995073f5b532a0d0e7d3a005ff042ab8cec163	2026-06-23 16:18:48.154551+08	20260623000000_add_item_updated_audit_action	\N	\N	2026-06-23 16:18:48.135113+08	1
\.


--
-- Name: AccountVehicle AccountVehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountVehicle"
    ADD CONSTRAINT "AccountVehicle_pkey" PRIMARY KEY (id);


--
-- Name: Account Account_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Account"
    ADD CONSTRAINT "Account_pkey" PRIMARY KEY (id);


--
-- Name: Appointment Appointment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_pkey" PRIMARY KEY (id);


--
-- Name: AuditLog AuditLog_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_pkey" PRIMARY KEY (id);


--
-- Name: BranchSchedule BranchSchedule_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BranchSchedule"
    ADD CONSTRAINT "BranchSchedule_pkey" PRIMARY KEY (id);


--
-- Name: Branch Branch_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_pkey" PRIMARY KEY (id);


--
-- Name: Customer Customer_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_pkey" PRIMARY KEY (id);


--
-- Name: Device Device_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_pkey" PRIMARY KEY (id);


--
-- Name: DiagnosticReport DiagnosticReport_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticReport"
    ADD CONSTRAINT "DiagnosticReport_pkey" PRIMARY KEY (id);


--
-- Name: DiagnosticTemplate DiagnosticTemplate_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticTemplate"
    ADD CONSTRAINT "DiagnosticTemplate_pkey" PRIMARY KEY (id);


--
-- Name: LaborCategory LaborCategory_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LaborCategory"
    ADD CONSTRAINT "LaborCategory_pkey" PRIMARY KEY (id);


--
-- Name: Notification Notification_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_pkey" PRIMARY KEY (id);


--
-- Name: OrderDiagnostic OrderDiagnostic_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderDiagnostic"
    ADD CONSTRAINT "OrderDiagnostic_pkey" PRIMARY KEY (id);


--
-- Name: OrderPayment OrderPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_pkey" PRIMARY KEY (id);


--
-- Name: Otp Otp_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Otp"
    ADD CONSTRAINT "Otp_pkey" PRIMARY KEY (id);


--
-- Name: PlanFeature PlanFeature_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlanFeature"
    ADD CONSTRAINT "PlanFeature_pkey" PRIMARY KEY (id);


--
-- Name: PlanLimit PlanLimit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlanLimit"
    ADD CONSTRAINT "PlanLimit_pkey" PRIMARY KEY (id);


--
-- Name: PlanPrice PlanPrice_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlanPrice"
    ADD CONSTRAINT "PlanPrice_pkey" PRIMARY KEY (id);


--
-- Name: PlatformSetting PlatformSetting_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."PlatformSetting"
    ADD CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY (id);


--
-- Name: QPaySettings QPaySettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."QPaySettings"
    ADD CONSTRAINT "QPaySettings_pkey" PRIMARY KEY (id);


--
-- Name: RefreshToken RefreshToken_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_pkey" PRIMARY KEY (id);


--
-- Name: Role Role_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_pkey" PRIMARY KEY (id);


--
-- Name: ServiceItem ServiceItem_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceItem"
    ADD CONSTRAINT "ServiceItem_pkey" PRIMARY KEY (id);


--
-- Name: ServiceOrder ServiceOrder_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceOrder"
    ADD CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY (id);


--
-- Name: Service Service_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_pkey" PRIMARY KEY (id);


--
-- Name: SubscriptionPayment SubscriptionPayment_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SubscriptionPayment"
    ADD CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY (id);


--
-- Name: Subscription Subscription_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_pkey" PRIMARY KEY (id);


--
-- Name: SuperAdmin SuperAdmin_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SuperAdmin"
    ADD CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY (id);


--
-- Name: TenantQPaySettings TenantQPaySettings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TenantQPaySettings"
    ADD CONSTRAINT "TenantQPaySettings_pkey" PRIMARY KEY (id);


--
-- Name: Tenant Tenant_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Tenant"
    ADD CONSTRAINT "Tenant_pkey" PRIMARY KEY (id);


--
-- Name: Unit Unit_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Unit"
    ADD CONSTRAINT "Unit_pkey" PRIMARY KEY (id);


--
-- Name: UserSession UserSession_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserSession"
    ADD CONSTRAINT "UserSession_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: Vehicle Vehicle_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Vehicle"
    ADD CONSTRAINT "Vehicle_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: AccountVehicle_accountId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AccountVehicle_accountId_idx" ON public."AccountVehicle" USING btree ("accountId");


--
-- Name: AccountVehicle_accountId_plate_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "AccountVehicle_accountId_plate_key" ON public."AccountVehicle" USING btree ("accountId", plate);


--
-- Name: Account_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Account_phone_key" ON public."Account" USING btree (phone);


--
-- Name: Appointment_accountId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Appointment_accountId_idx" ON public."Appointment" USING btree ("accountId");


--
-- Name: Appointment_branchId_requestedAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Appointment_branchId_requestedAt_idx" ON public."Appointment" USING btree ("branchId", "requestedAt");


--
-- Name: Appointment_serviceOrderId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Appointment_serviceOrderId_key" ON public."Appointment" USING btree ("serviceOrderId");


--
-- Name: Appointment_status_requestedAt_reminderSentAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Appointment_status_requestedAt_reminderSentAt_idx" ON public."Appointment" USING btree (status, "requestedAt", "reminderSentAt");


--
-- Name: Appointment_tenantId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Appointment_tenantId_status_idx" ON public."Appointment" USING btree ("tenantId", status);


--
-- Name: AuditLog_tenantId_action_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_tenantId_action_createdAt_idx" ON public."AuditLog" USING btree ("tenantId", action, "createdAt");


--
-- Name: AuditLog_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON public."AuditLog" USING btree ("tenantId", "createdAt");


--
-- Name: AuditLog_tenantId_entity_entityId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_tenantId_entity_entityId_idx" ON public."AuditLog" USING btree ("tenantId", entity, "entityId");


--
-- Name: AuditLog_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "AuditLog_userId_idx" ON public."AuditLog" USING btree ("userId");


--
-- Name: BranchSchedule_branchId_weekday_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "BranchSchedule_branchId_weekday_key" ON public."BranchSchedule" USING btree ("branchId", weekday);


--
-- Name: BranchSchedule_weekday_isOpen_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "BranchSchedule_weekday_isOpen_idx" ON public."BranchSchedule" USING btree (weekday, "isOpen");


--
-- Name: Branch_tenantId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Branch_tenantId_idx" ON public."Branch" USING btree ("tenantId");


--
-- Name: Customer_tenantId_accountId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Customer_tenantId_accountId_key" ON public."Customer" USING btree ("tenantId", "accountId");


--
-- Name: Customer_tenantId_phone_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Customer_tenantId_phone_idx" ON public."Customer" USING btree ("tenantId", phone);


--
-- Name: Device_accountId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_accountId_idx" ON public."Device" USING btree ("accountId");


--
-- Name: Device_deviceId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Device_deviceId_key" ON public."Device" USING btree ("deviceId");


--
-- Name: Device_firebaseToken_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_firebaseToken_idx" ON public."Device" USING btree ("firebaseToken");


--
-- Name: Device_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Device_userId_idx" ON public."Device" USING btree ("userId");


--
-- Name: DiagnosticReport_branchId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiagnosticReport_branchId_idx" ON public."DiagnosticReport" USING btree ("branchId");


--
-- Name: DiagnosticReport_customerId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiagnosticReport_customerId_idx" ON public."DiagnosticReport" USING btree ("customerId");


--
-- Name: DiagnosticReport_templateId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiagnosticReport_templateId_idx" ON public."DiagnosticReport" USING btree ("templateId");


--
-- Name: DiagnosticReport_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiagnosticReport_tenantId_createdAt_idx" ON public."DiagnosticReport" USING btree ("tenantId", "createdAt");


--
-- Name: DiagnosticReport_tenantId_orderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiagnosticReport_tenantId_orderId_idx" ON public."DiagnosticReport" USING btree ("tenantId", "orderId");


--
-- Name: DiagnosticReport_vehicleId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiagnosticReport_vehicleId_idx" ON public."DiagnosticReport" USING btree ("vehicleId");


--
-- Name: DiagnosticTemplate_tenantId_type_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "DiagnosticTemplate_tenantId_type_isActive_idx" ON public."DiagnosticTemplate" USING btree ("tenantId", type, "isActive");


--
-- Name: LaborCategory_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "LaborCategory_tenantId_isActive_idx" ON public."LaborCategory" USING btree ("tenantId", "isActive");


--
-- Name: LaborCategory_tenantId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "LaborCategory_tenantId_name_key" ON public."LaborCategory" USING btree ("tenantId", name);


--
-- Name: Notification_accountId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_accountId_createdAt_idx" ON public."Notification" USING btree ("accountId", "createdAt" DESC);


--
-- Name: Notification_accountId_readAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_accountId_readAt_idx" ON public."Notification" USING btree ("accountId", "readAt");


--
-- Name: Notification_dedupeKey_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Notification_dedupeKey_key" ON public."Notification" USING btree ("dedupeKey");


--
-- Name: Notification_userId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_userId_createdAt_idx" ON public."Notification" USING btree ("userId", "createdAt" DESC);


--
-- Name: Notification_userId_readAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Notification_userId_readAt_idx" ON public."Notification" USING btree ("userId", "readAt");


--
-- Name: OrderDiagnostic_orderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderDiagnostic_orderId_idx" ON public."OrderDiagnostic" USING btree ("orderId");


--
-- Name: OrderDiagnostic_orderId_templateId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "OrderDiagnostic_orderId_templateId_key" ON public."OrderDiagnostic" USING btree ("orderId", "templateId");


--
-- Name: OrderPayment_orderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderPayment_orderId_idx" ON public."OrderPayment" USING btree ("orderId");


--
-- Name: OrderPayment_qpayInvoiceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderPayment_qpayInvoiceId_idx" ON public."OrderPayment" USING btree ("qpayInvoiceId");


--
-- Name: OrderPayment_tenantId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "OrderPayment_tenantId_status_idx" ON public."OrderPayment" USING btree ("tenantId", status);


--
-- Name: Otp_email_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Otp_email_type_idx" ON public."Otp" USING btree (email, type);


--
-- Name: Otp_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Otp_expiresAt_idx" ON public."Otp" USING btree ("expiresAt");


--
-- Name: Otp_phone_type_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Otp_phone_type_idx" ON public."Otp" USING btree (phone, type);


--
-- Name: Otp_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Otp_userId_idx" ON public."Otp" USING btree ("userId");


--
-- Name: PlanFeature_plan_sortOrder_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PlanFeature_plan_sortOrder_idx" ON public."PlanFeature" USING btree (plan, "sortOrder");


--
-- Name: PlanLimit_plan_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PlanLimit_plan_code_key" ON public."PlanLimit" USING btree (plan, code);


--
-- Name: PlanLimit_plan_sortOrder_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PlanLimit_plan_sortOrder_idx" ON public."PlanLimit" USING btree (plan, "sortOrder");


--
-- Name: PlanPrice_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "PlanPrice_isActive_idx" ON public."PlanPrice" USING btree ("isActive");


--
-- Name: PlanPrice_plan_period_currency_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "PlanPrice_plan_period_currency_key" ON public."PlanPrice" USING btree (plan, period, currency);


--
-- Name: RefreshToken_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RefreshToken_expiresAt_idx" ON public."RefreshToken" USING btree ("expiresAt");


--
-- Name: RefreshToken_tokenHash_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON public."RefreshToken" USING btree ("tokenHash");


--
-- Name: RefreshToken_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "RefreshToken_userId_idx" ON public."RefreshToken" USING btree ("userId");


--
-- Name: Role_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Role_tenantId_isActive_idx" ON public."Role" USING btree ("tenantId", "isActive");


--
-- Name: Role_tenantId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Role_tenantId_name_key" ON public."Role" USING btree ("tenantId", name);


--
-- Name: ServiceItem_orderId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ServiceItem_orderId_idx" ON public."ServiceItem" USING btree ("orderId");


--
-- Name: ServiceItem_serviceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ServiceItem_serviceId_idx" ON public."ServiceItem" USING btree ("serviceId");


--
-- Name: ServiceOrder_branchId_scheduledAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ServiceOrder_branchId_scheduledAt_idx" ON public."ServiceOrder" USING btree ("branchId", "scheduledAt");


--
-- Name: ServiceOrder_tenantId_number_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "ServiceOrder_tenantId_number_key" ON public."ServiceOrder" USING btree ("tenantId", number);


--
-- Name: ServiceOrder_tenantId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "ServiceOrder_tenantId_status_idx" ON public."ServiceOrder" USING btree ("tenantId", status);


--
-- Name: Service_durationUnitId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Service_durationUnitId_idx" ON public."Service" USING btree ("durationUnitId");


--
-- Name: Service_laborCategoryId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Service_laborCategoryId_idx" ON public."Service" USING btree ("laborCategoryId");


--
-- Name: Service_tenantId_name_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Service_tenantId_name_idx" ON public."Service" USING btree ("tenantId", name);


--
-- Name: Service_tenantId_type_code_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Service_tenantId_type_code_key" ON public."Service" USING btree ("tenantId", type, code);


--
-- Name: Service_tenantId_type_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Service_tenantId_type_isActive_idx" ON public."Service" USING btree ("tenantId", type, "isActive");


--
-- Name: Service_unitId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Service_unitId_idx" ON public."Service" USING btree ("unitId");


--
-- Name: SubscriptionPayment_createdSubscriptionId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SubscriptionPayment_createdSubscriptionId_key" ON public."SubscriptionPayment" USING btree ("createdSubscriptionId");


--
-- Name: SubscriptionPayment_qpayInvoiceId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SubscriptionPayment_qpayInvoiceId_idx" ON public."SubscriptionPayment" USING btree ("qpayInvoiceId");


--
-- Name: SubscriptionPayment_tenantId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "SubscriptionPayment_tenantId_status_idx" ON public."SubscriptionPayment" USING btree ("tenantId", status);


--
-- Name: Subscription_endsAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Subscription_endsAt_idx" ON public."Subscription" USING btree ("endsAt");


--
-- Name: Subscription_tenantId_createdAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Subscription_tenantId_createdAt_idx" ON public."Subscription" USING btree ("tenantId", "createdAt");


--
-- Name: Subscription_tenantId_status_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Subscription_tenantId_status_idx" ON public."Subscription" USING btree ("tenantId", status);


--
-- Name: SuperAdmin_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "SuperAdmin_email_key" ON public."SuperAdmin" USING btree (email);


--
-- Name: TenantQPaySettings_tenantId_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "TenantQPaySettings_tenantId_key" ON public."TenantQPaySettings" USING btree ("tenantId");


--
-- Name: Tenant_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Tenant_email_key" ON public."Tenant" USING btree (email);


--
-- Name: Tenant_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Tenant_name_key" ON public."Tenant" USING btree (name);


--
-- Name: Tenant_registerNumber_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Tenant_registerNumber_key" ON public."Tenant" USING btree ("registerNumber");


--
-- Name: Tenant_slug_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Tenant_slug_key" ON public."Tenant" USING btree (slug);


--
-- Name: Unit_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Unit_tenantId_isActive_idx" ON public."Unit" USING btree ("tenantId", "isActive");


--
-- Name: Unit_tenantId_name_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Unit_tenantId_name_key" ON public."Unit" USING btree ("tenantId", name);


--
-- Name: UserSession_expiresAt_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "UserSession_expiresAt_idx" ON public."UserSession" USING btree ("expiresAt");


--
-- Name: UserSession_userId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "UserSession_userId_idx" ON public."UserSession" USING btree ("userId");


--
-- Name: User_activeUntil_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_activeUntil_idx" ON public."User" USING btree ("activeUntil");


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_phone_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "User_phone_key" ON public."User" USING btree (phone);


--
-- Name: User_roleId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_roleId_idx" ON public."User" USING btree ("roleId");


--
-- Name: User_tenantId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_tenantId_idx" ON public."User" USING btree ("tenantId");


--
-- Name: User_tenantId_isActive_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_tenantId_isActive_idx" ON public."User" USING btree ("tenantId", "isActive");


--
-- Name: User_tenantId_isOwner_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "User_tenantId_isOwner_idx" ON public."User" USING btree ("tenantId", "isOwner");


--
-- Name: Vehicle_tenantId_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "Vehicle_tenantId_idx" ON public."Vehicle" USING btree ("tenantId");


--
-- Name: Vehicle_tenantId_plate_key; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX "Vehicle_tenantId_plate_key" ON public."Vehicle" USING btree ("tenantId", plate);


--
-- Name: AccountVehicle AccountVehicle_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AccountVehicle"
    ADD CONSTRAINT "AccountVehicle_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Appointment Appointment_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Appointment Appointment_accountVehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_accountVehicleId_fkey" FOREIGN KEY ("accountVehicleId") REFERENCES public."AccountVehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Appointment Appointment_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Appointment Appointment_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Appointment Appointment_serviceOrderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Appointment Appointment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Appointment Appointment_vehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Appointment"
    ADD CONSTRAINT "Appointment_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditLog AuditLog_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: AuditLog AuditLog_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: AuditLog AuditLog_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."AuditLog"
    ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: BranchSchedule BranchSchedule_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."BranchSchedule"
    ADD CONSTRAINT "BranchSchedule_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Branch Branch_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Branch"
    ADD CONSTRAINT "Branch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Customer Customer_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Customer Customer_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Customer"
    ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Device Device_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Device Device_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Device"
    ADD CONSTRAINT "Device_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiagnosticReport DiagnosticReport_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticReport"
    ADD CONSTRAINT "DiagnosticReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiagnosticReport DiagnosticReport_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticReport"
    ADD CONSTRAINT "DiagnosticReport_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiagnosticReport DiagnosticReport_filledById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticReport"
    ADD CONSTRAINT "DiagnosticReport_filledById_fkey" FOREIGN KEY ("filledById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DiagnosticReport DiagnosticReport_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticReport"
    ADD CONSTRAINT "DiagnosticReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DiagnosticReport DiagnosticReport_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticReport"
    ADD CONSTRAINT "DiagnosticReport_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."DiagnosticTemplate"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiagnosticReport DiagnosticReport_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticReport"
    ADD CONSTRAINT "DiagnosticReport_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: DiagnosticReport DiagnosticReport_vehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticReport"
    ADD CONSTRAINT "DiagnosticReport_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: DiagnosticTemplate DiagnosticTemplate_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticTemplate"
    ADD CONSTRAINT "DiagnosticTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: DiagnosticTemplate DiagnosticTemplate_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."DiagnosticTemplate"
    ADD CONSTRAINT "DiagnosticTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: LaborCategory LaborCategory_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."LaborCategory"
    ADD CONSTRAINT "LaborCategory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_accountId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES public."Account"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Notification Notification_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Notification"
    ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderDiagnostic OrderDiagnostic_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderDiagnostic"
    ADD CONSTRAINT "OrderDiagnostic_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderDiagnostic OrderDiagnostic_templateId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderDiagnostic"
    ADD CONSTRAINT "OrderDiagnostic_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."DiagnosticTemplate"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderPayment OrderPayment_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: OrderPayment OrderPayment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."OrderPayment"
    ADD CONSTRAINT "OrderPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: RefreshToken RefreshToken_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."RefreshToken"
    ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Role Role_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Role"
    ADD CONSTRAINT "Role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceItem ServiceItem_orderId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceItem"
    ADD CONSTRAINT "ServiceItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES public."ServiceOrder"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceItem ServiceItem_serviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceItem"
    ADD CONSTRAINT "ServiceItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES public."Service"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceOrder ServiceOrder_assignedToId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceOrder"
    ADD CONSTRAINT "ServiceOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: ServiceOrder ServiceOrder_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceOrder"
    ADD CONSTRAINT "ServiceOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServiceOrder ServiceOrder_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceOrder"
    ADD CONSTRAINT "ServiceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: ServiceOrder ServiceOrder_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceOrder"
    ADD CONSTRAINT "ServiceOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: ServiceOrder ServiceOrder_vehicleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."ServiceOrder"
    ADD CONSTRAINT "ServiceOrder_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES public."Vehicle"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Service Service_durationUnitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_durationUnitId_fkey" FOREIGN KEY ("durationUnitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Service Service_laborCategoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_laborCategoryId_fkey" FOREIGN KEY ("laborCategoryId") REFERENCES public."LaborCategory"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Service Service_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Service Service_unitId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Service"
    ADD CONSTRAINT "Service_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES public."Unit"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SubscriptionPayment SubscriptionPayment_planPriceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SubscriptionPayment"
    ADD CONSTRAINT "SubscriptionPayment_planPriceId_fkey" FOREIGN KEY ("planPriceId") REFERENCES public."PlanPrice"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: SubscriptionPayment SubscriptionPayment_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."SubscriptionPayment"
    ADD CONSTRAINT "SubscriptionPayment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Subscription Subscription_createdById_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES public."SuperAdmin"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Subscription Subscription_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Subscription"
    ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: TenantQPaySettings TenantQPaySettings_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."TenantQPaySettings"
    ADD CONSTRAINT "TenantQPaySettings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Unit Unit_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Unit"
    ADD CONSTRAINT "Unit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: UserSession UserSession_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."UserSession"
    ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: User User_branchId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES public."Branch"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_roleId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: User User_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Vehicle Vehicle_customerId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Vehicle"
    ADD CONSTRAINT "Vehicle_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES public."Customer"(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: Vehicle Vehicle_tenantId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public."Vehicle"
    ADD CONSTRAINT "Vehicle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES public."Tenant"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict tJwIPR5yJlEn0MEWMlLwtpJ5Qr9K13lmzqW1X5Zb0RkUnaU7bmJKjmx3NlPcT6u

