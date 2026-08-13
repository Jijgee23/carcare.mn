-- Appointment.respondedById-г бодит FK relation болгож User руу холбоно (хэн хариулсныг найдвартай join хийхийн тулд).
CREATE INDEX "Appointment_respondedById_idx" ON "Appointment"("respondedById");
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_respondedById_fkey"
  FOREIGN KEY ("respondedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
