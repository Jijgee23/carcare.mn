-- RLS: "indirect-FK" policy — эцэг хүснэгтээрээ дамжуулан tenant тусгаарлана.
-- Эдгээр 10 хүснэгт өөрсдөө `tenantId` багана агуулаагүй тул шууд
-- `tenantId = current_setting(...)` шалгалт хийх боломжгүй — оронд нь тухайн
-- мөрийн эцэг (ServiceOrder/Appointment/Branch/User) аль хэдийн RLS-тэй
-- (20260813070000_rls_remaining_tenant_tables) тул тэдгээрийн `tenantId`-г
-- EXISTS subquery-аар шалгана. (Мэдэгдэж байсан цоорхой — харах:
-- [[rls-tenant-isolation]] memory-ийн "BranchSchedule/ServiceItem/
-- OrderDiagnostic-д шууд tenantId багана байхгүй" тэмдэглэл.)
--
-- Урьд нь эдгээр хүснэгт зөвхөн app-level join-оор (эцэг хүснэгтээр дамжуулан)
-- хамгаалагдаж байсан — parent join-гүй raw query/migration script бичвэл
-- tenant isolation бүхэлдээ алгасах эрсдэлтэй байсныг ЭНД хаана.

-- ServiceItem — orderId -> ServiceOrder.tenantId
ALTER TABLE "ServiceItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ServiceItem"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "ServiceOrder" so
      WHERE so.id = "ServiceItem"."orderId"
        AND so."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "ServiceOrder" so
      WHERE so.id = "ServiceItem"."orderId"
        AND so."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- AppointmentCategory — appointmentId -> Appointment.tenantId
ALTER TABLE "AppointmentCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AppointmentCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "AppointmentCategory"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Appointment" a
      WHERE a.id = "AppointmentCategory"."appointmentId"
        AND a."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Appointment" a
      WHERE a.id = "AppointmentCategory"."appointmentId"
        AND a."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- BranchSchedule — branchId -> Branch.tenantId
ALTER TABLE "BranchSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchSchedule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BranchSchedule"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "BranchSchedule"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "BranchSchedule"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- BranchScheduleException — branchId -> Branch.tenantId
ALTER TABLE "BranchScheduleException" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchScheduleException" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BranchScheduleException"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "BranchScheduleException"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "BranchScheduleException"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- BranchScheduleSeason — branchId -> Branch.tenantId
ALTER TABLE "BranchScheduleSeason" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchScheduleSeason" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BranchScheduleSeason"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "BranchScheduleSeason"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "BranchScheduleSeason"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- BranchScheduleSeasonDay — seasonId -> BranchScheduleSeason -> branchId -> Branch.tenantId
-- (энэ хүснэгт зөвхөн 2 үеийн (grandchild) FK-тай цорын ганц тохиолдол).
ALTER TABLE "BranchScheduleSeasonDay" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BranchScheduleSeasonDay" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "BranchScheduleSeasonDay"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "BranchScheduleSeason" s
      JOIN "Branch" b ON b.id = s."branchId"
      WHERE s.id = "BranchScheduleSeasonDay"."seasonId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "BranchScheduleSeason" s
      JOIN "Branch" b ON b.id = s."branchId"
      WHERE s.id = "BranchScheduleSeasonDay"."seasonId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- EmployeeWorkSchedule — userId -> User.tenantId
ALTER TABLE "EmployeeWorkSchedule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeWorkSchedule" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EmployeeWorkSchedule"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "EmployeeWorkSchedule"."userId"
        AND u."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "EmployeeWorkSchedule"."userId"
        AND u."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- EmployeeWorkScheduleSegment — өөрөө шууд branchId -> Branch.tenantId агуулдаг
-- тул scheduleId->EmployeeWorkSchedule->userId->User гэсэн 2 үеийн join хийх
-- шаардлагагүй.
ALTER TABLE "EmployeeWorkScheduleSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeWorkScheduleSegment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EmployeeWorkScheduleSegment"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "EmployeeWorkScheduleSegment"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "EmployeeWorkScheduleSegment"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- EmployeeScheduleException — userId -> User.tenantId
ALTER TABLE "EmployeeScheduleException" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeScheduleException" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EmployeeScheduleException"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "EmployeeScheduleException"."userId"
        AND u."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = "EmployeeScheduleException"."userId"
        AND u."tenantId" = current_setting('app.tenant_id', true)
    )
  );

-- EmployeeScheduleExceptionSegment — EmployeeWorkScheduleSegment-тэй адил
-- шууд branchId агуулдаг.
ALTER TABLE "EmployeeScheduleExceptionSegment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeScheduleExceptionSegment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "EmployeeScheduleExceptionSegment"
  USING (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "EmployeeScheduleExceptionSegment"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  )
  WITH CHECK (
    current_setting('app.bypass_rls', true) = 'on'
    OR EXISTS (
      SELECT 1 FROM "Branch" b
      WHERE b.id = "EmployeeScheduleExceptionSegment"."branchId"
        AND b."tenantId" = current_setting('app.tenant_id', true)
    )
  );
