"""鞣坑放液门槛：最近一次浸液酸碱度须在 3.5～5.0。"""

import re

from pits.models import AppSetting, Pit

MIN_PH = 3.5
MAX_PH = 5.0

# 整数部分任意位，小数点后恰好一位，例如 4.2；拒绝 4 / 4.25 / 4. / .2
ONE_DECIMAL_RE = re.compile(r"^[+-]?\d+\.\d$")


class RuleError(ValueError):
    pass


def ph_one_decimal_on() -> bool:
    return AppSetting.is_on(AppSetting.SETTING_PH_ONE_DECIMAL)


def parse_ph(raw, one_decimal: bool) -> float:
    """按闸门状态解析原始酸碱度文本；非法即抛 RuleError，绝不落库。"""
    if not isinstance(raw, str):
        raise RuleError("酸碱度必须以文本提交")
    text = raw.strip()
    if text == "":
        raise RuleError("酸碱度不能为空")
    if one_decimal:
        if ONE_DECIMAL_RE.fullmatch(text) is None:
            raise RuleError("当前要求酸碱度小数点后恰好一位（例如 4.2），整数或两位及以上一律不收")
        return float(text)
    try:
        value = float(text)
    except ValueError:
        raise RuleError("酸碱度必须是数字")
    return value


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
