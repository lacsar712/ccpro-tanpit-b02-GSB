from typing import Any

from ninja import NinjaAPI, Schema
from ninja.errors import HttpError

from pits.auth import BearerAuth, make_token
from pits.models import GateSwitch, Pit, User, Yard
from pits.rules import (
    GATE_ONE_DECIMAL,
    GATE_ONE_DECIMAL_LABEL,
    RuleError,
    assert_can_set_status,
    latest_ph,
    parse_ph_for_write,
)

api = NinjaAPI(title="TanPit", urls_namespace="tanpit")
auth = BearerAuth()


class LoginIn(Schema):
    username: str
    password: str


class SampleIn(Schema):
    # 保留原始写入形式（整数/浮点/字符串），小数位规矩按写入形式判定
    ph: Any


class StatusIn(Schema):
    status: str


class GateIn(Schema):
    enabled: bool


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


def gate_json(switch: GateSwitch) -> dict:
    return {"key": switch.key, "label": switch.label, "enabled": switch.enabled}


def ensure_gates() -> None:
    GateSwitch.objects.get_or_create(
        key=GATE_ONE_DECIMAL, defaults={"label": GATE_ONE_DECIMAL_LABEL}
    )


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
    return {"yard": yard.name, "village": yard.village, "pits": [pit_json(p) for p in pits]}


@api.get("/gates", auth=auth)
def list_gates(request):
    ensure_gates()
    switches = GateSwitch.objects.all().order_by("key")
    return {"gates": [gate_json(s) for s in switches]}


def set_gate(user: User, key: str, enabled: bool) -> dict:
    if user.role != "admin":
        raise HttpError(403, "只有管理员可以拨动闸门开关")
    ensure_gates()
    switch = GateSwitch.objects.filter(key=key).first()
    if switch is None:
        raise HttpError(404, "闸门不存在")
    switch.enabled = enabled
    switch.save(update_fields=["enabled"])
    return gate_json(switch)


@api.put("/gates/{key}", auth=auth)
def set_gate_put(request, key: str, payload: GateIn):
    return set_gate(request.auth, key, payload.enabled)


@api.post("/gates/{key}", auth=auth)
def set_gate_post(request, key: str, payload: GateIn):
    return set_gate(request.auth, key, payload.enabled)


@api.post("/pits/{pit_id}/samples", auth=auth)
def add_sample(request, pit_id: int, payload: SampleIn):
    pit = Pit.objects.filter(id=pit_id).first()
    if pit is None:
        raise HttpError(404, "坑不存在")
    try:
        ph = parse_ph_for_write(payload.ph)
    except RuleError as exc:
        raise HttpError(400, str(exc))
    pit.samples.create(ph=ph, operator=request.auth.username)
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
