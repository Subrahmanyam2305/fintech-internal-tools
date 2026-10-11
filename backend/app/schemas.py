from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    @field_serializer("*", check_fields=False)
    def _ser_dt(self, v):
        if isinstance(v, datetime):
            return v.strftime("%Y-%m-%dT%H:%M:%S.") + f"{v.microsecond // 1000:03d}Z"
        return v


class UserOut(ORMModel):
    id: int
    name: str
    role: str


class KycOut(ORMModel):
    id: int
    customer_name: str
    customer_email: str
    country: str
    status: str
    risk_level: str
    submitted_at: datetime
    reviewed_by: str | None
    reviewed_at: datetime | None
    notes: str | None
    document_urls: list[str]


class KycActionBody(BaseModel):
    notes: str | None = None


class KycRejectBody(BaseModel):
    reason: str


class KycRequestInfoBody(BaseModel):
    message: str | None = None


class RefundOut(ORMModel):
    id: int
    customer_name: str
    order_id: str
    original_amount: float
    refund_amount: float
    reason: str
    status: str
    requested_by: str
    approved_by: str | None
    rejection_reason: str | None
    requested_at: datetime
    completed_at: datetime | None
    requires_manager_approval: bool = False


class RefundCreateBody(BaseModel):
    customer_name: str
    order_id: str
    original_amount: Decimal = Field(
        gt=0, decimal_places=2, allow_inf_nan=False
    )
    refund_amount: Decimal = Field(
        gt=0, decimal_places=2, allow_inf_nan=False
    )
    reason: str


class RefundRejectBody(BaseModel):
    reason: str | None = None


class FlagOut(ORMModel):
    id: int
    key: str
    name: str
    description: str
    enabled: bool
    rollout_percent: int
    environment: str
    created_by: str
    updated_at: datetime


class FlagRuntimeOut(ORMModel):
    key: str
    name: str
    rollout_percent: int
    environment: str
    updated_at: datetime


class FlagPatchBody(BaseModel):
    enabled: bool | None = None
    rollout_percent: int | None = None


class AuditOut(ORMModel):
    id: int
    user_id: int
    user_name: str
    user_role: str
    action: str
    entity_type: str
    entity_id: int
    field: str
    previous_value: str | None
    new_value: str | None
    created_at: datetime
