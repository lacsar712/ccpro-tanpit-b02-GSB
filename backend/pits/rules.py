"""鞣坑放液门槛：最近一次浸液酸碱度须在 3.5～5.0。

另有「小数位」闸门：管理员打开后，登记酸碱度小数点后须恰好一位（如 4.2），
整数或两位及以上整笔拒绝；关闭后恢复原有可写规则。改坑态不看小数位。
"""

import math
import re
from decimal import Decimal

from pits.models import GateSwitch, Pit

MIN_PH = 3.5
MAX_PH = 5.0

GATE_ONE_DECIMAL = "ph_one_decimal"
GATE_ONE_DECIMAL_LABEL = "酸碱度必须一位小数"

_ONE_DECIMAL_RE = re.compile(r"[+-]?\d*\.(\d+)")


class RuleError(ValueError):
    pass


def latest_ph(pit: Pit) -> float | None:
    sample = pit.samples.order_by("-taken_at", "-id").first()
    return None if sample is None else sample.ph


def assert_can_set_status(pit: Pit, new_status: str) -> None:
    allowed = {Pit.STATUS_FILL, Pit.STATUS_TANNING, Pit.STATUS_DRAINED}
    if new_status not in allowed:
        raise RuleError(f"无效状态：{new_status}")
    if new_status != Pit.STATUS_DRAINED:
        return
    ph = latest_ph(pit)
    if ph is None:
        raise RuleError("该坑尚无浸液酸碱记录，不能放液")
    if ph < MIN_PH or ph > MAX_PH:
        raise RuleError(f"最近酸碱度 {ph} 不在 {MIN_PH}～{MAX_PH}，不能放液")


def gate_enabled(key: str) -> bool:
    switch = GateSwitch.objects.filter(key=key).first()
    return bool(switch and switch.enabled)


def _written_decimal_places(value) -> int:
    """按写入形式数小数点后的位数；数不出来返回 -1。"""
    if isinstance(value, bool):
        return -1
    if isinstance(value, int):
        return 0
    if isinstance(value, float):
        if not math.isfinite(value):
            return -1
        exponent = Decimal(repr(value)).as_tuple().exponent
        return -exponent if exponent < 0 else 0
    if isinstance(value, str):
        match = _ONE_DECIMAL_RE.fullmatch(value.strip())
        return len(match.group(1)) if match else 0
    return -1


def parse_ph_for_write(value) -> float:
    """登记酸碱度入口：空值、非数一律拒；闸门打开时须恰好一位小数。

    先验后写，验不过整笔拒绝，绝不先入库再改显示。
    """
    if value is None or isinstance(value, bool):
        raise RuleError("酸碱度必须是数字")
    if isinstance(value, (int, float)):
        ph = float(value)
    elif isinstance(value, str):
        text = value.strip()
        if not text:
            raise RuleError("酸碱度不能为空")
        try:
            ph = float(text)
        except ValueError:
            raise RuleError("酸碱度必须是数字") from None
    else:
        raise RuleError("酸碱度必须是数字")
    if not math.isfinite(ph):
        raise RuleError("酸碱度必须是有限数字")
    if gate_enabled(GATE_ONE_DECIMAL) and _written_decimal_places(value) != 1:
        raise RuleError("已开启「必须一位小数」：酸碱度小数点后须恰好一位，如 4.2")
    return ph
