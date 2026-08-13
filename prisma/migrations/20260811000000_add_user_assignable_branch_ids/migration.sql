-- User.branchId (үндсэн салбар)-аас гадна олон салбарт дамжиж ажилладаг
-- ажилтныг захиалгад хариуцагчаар сонгож болох НЭМЭЛТ салбаруудын жагсаалт.
-- Зөвхөн order-form-ийн "Хариуцах мастер" сонголтод ашиглагдана — өгөгдөл
-- хандалтын хамрах хүрээг (branchScopeId) өөрчлөхгүй. FK constraint-гүй.
ALTER TABLE "User" ADD COLUMN "assignableBranchIds" TEXT[] NOT NULL DEFAULT '{}';
