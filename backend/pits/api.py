from ninja import NinjaAPI, Schema
from ninja.errors import HttpError
from pydantic import field_validator

from pits.auth import BearerAuth, make_token
from pits.models import AppSetting, Pit, User, Yard
from pits.rules import (
    RuleError,
    assert_can_set_status,
    latest_ph,
    parse_ph,
    ph_one_decimal_on,
)

api = NinjaAPI(title="TanPit", urls_namespace="tanpit")
auth = BearerAuth()


class LoginIn(Schema):
    username: str
    password: str


class SampleIn(Schema):
    # 原始文本：小数点位数必须在服务端按原文判定，不能让客户端先 Number() 抹平
    ph: str

    @field_validator("ph", mode="before")
    @classmethod
    def ph_must_be_text(cls, value):
        if not isinstance(value, str):
            raise ValueError("酸碱度必须以文本提交，不能是数字或空值")
        return value


class StatusIn(Schema):
    status: str


class SettingsIn(Schema):
    ph_one_decimal: bool


def pit_json(pit: Pit) -> dict:
    return {
        "id": pit.id,
        "code": pit.code,
        "status": pit.status,
        "row": pit.row,
        "col": pit.col,
        "latestPh": latest_ph(pit),
        "sampleCount": pit.samples.count(),
    }


@api.post("/auth/login")
def login(request, payload: LoginIn):
    user = User.objects.filter(username=payload.username).first()
    if user is None or not user.check_password(payload.password):
        raise HttpError(401, "用户名或密码错误")
    return {"access_token": make_token(user.username), "user": {"username": user.username, "role": user.role}}


@api.get("/auth/me", auth=auth)
def me(request):
    user = request.auth
    return {"username": user.username, "role": user.role}


@api.get("/health")
def health(request):
    return {"status": "ok", "service": "TanPit"}


@api.get("/board", auth=auth)
def board(request):
    yard = Yard.objects.prefetch_related("pits__samples").first()
    if yard is None:
        raise HttpError(404, "尚无鞣场")
    pits = sorted(yard.pits.all(), key=lambda p: (p.row, p.col))
    return {
        "yard": yard.name,
        "village": yard.village,
        "pits": [pit_json(p) for p in pits],
        "phOneDecimal": ph_one_decimal_on(),
    }


@api.post("/pits/{pit_id}/samples", auth=auth)
def add_sample(request, pit_id: int, payload: SampleIn):
    pit = Pit.objects.filter(id=pit_id).first()
    if pit is None:
        raise HttpError(404, "坑不存在")
    try:
        ph_value = parse_ph(payload.ph, ph_one_decimal_on())
    except RuleError as exc:
        # 校验在写库之前：非法读数不得产生任何记录
        raise HttpError(400, str(exc))
    pit.samples.create(ph=ph_value, operator=request.auth.username)
    pit.refresh_from_db()
    return pit_json(pit)


@api.post("/pits/{pit_id}/status", auth=auth)
def set_status(request, pit_id: int, payload: StatusIn):
    pit = Pit.objects.filter(id=pit_id).first()
    if pit is None:
        raise HttpError(404, "坑不存在")
    try:
        assert_can_set_status(pit, payload.status)
    except RuleError as exc:
        raise HttpError(400, str(exc))
    pit.status = payload.status
    pit.save(update_fields=["status"])
    return pit_json(pit)


def settings_json() -> dict:
    return {"ph_one_decimal": ph_one_decimal_on()}


@api.get("/settings/decimal", auth=auth)
def get_decimal_setting(request):
    # 操作工可进专页浏览开关，但只读
    return settings_json()


@api.put("/settings/decimal", auth=auth)
def set_decimal_setting(request, payload: SettingsIn):
    if request.auth.role != "admin":
        raise HttpError(403, "只有管理员可以开关小数位闸门")
    AppSetting.objects.update_or_create(
        name=AppSetting.SETTING_PH_ONE_DECIMAL,
        defaults={"value": payload.ph_one_decimal},
    )
    return settings_json()
