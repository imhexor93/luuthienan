"""
Script tạo file Excel Master Dashboard cho chiến dịch ra mắt TIAN
(Lọ tỏa hương & Lọ treo bồn cầu) - 6 Giai đoạn.
"""

import pandas as pd
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from datetime import datetime, timedelta

# ============================================================
# 1. Định nghĩa dữ liệu Master Dashboard
# ============================================================

# Ngày Launch giả định (D-Day)
D_DAY = datetime(2026, 5, 15)

def d(offset):
    """Trả về ngày dựa trên offset so với D-Day."""
    return (D_DAY + timedelta(days=offset)).strftime("%Y-%m-%d")

tasks = [
    # ── Giai đoạn 1: Lên Concept & Chuẩn bị (D-30 → D-21) ──
    {
        "Mã Task": "GD1-01",
        "Giai đoạn": "GĐ1: Lên Concept & Chuẩn bị",
        "Phòng ban": "Marketing",
        "Hạng mục công việc": "Chốt USP sản phẩm (Lọ tỏa hương & Lọ treo bồn cầu)",
        "PIC": "Nguyễn Văn A",
        "Ngày bắt đầu": d(-30),
        "Deadline": d(-26),
        "Trạng thái": "Done",
        "Tiến độ (%)": 100,
        "Link Sheet Chi tiết": "→ Sheet 'GD1_Concept'",
    },
    {
        "Mã Task": "GD1-02",
        "Giai đoạn": "GĐ1: Lên Concept & Chuẩn bị",
        "Phòng ban": "Content",
        "Hạng mục công việc": "Lên kịch bản outline (video review, seeding post)",
        "PIC": "Trần Thị B",
        "Ngày bắt đầu": d(-28),
        "Deadline": d(-23),
        "Trạng thái": "Doing",
        "Tiến độ (%)": 60,
        "Link Sheet Chi tiết": "→ Sheet 'GD1_Concept'",
    },
    {
        "Mã Task": "GD1-03",
        "Giai đoạn": "GĐ1: Lên Concept & Chuẩn bị",
        "Phòng ban": "KOC/PR",
        "Hạng mục công việc": "List danh sách KOC mục tiêu & gửi brief",
        "PIC": "Lê Văn C",
        "Ngày bắt đầu": d(-27),
        "Deadline": d(-21),
        "Trạng thái": "Doing",
        "Tiến độ (%)": 40,
        "Link Sheet Chi tiết": "→ Sheet 'GD1_Concept'",
    },

    # ── Giai đoạn 2: Sản xuất & Setup (D-20 → D-7) ──
    {
        "Mã Task": "GD2-01",
        "Giai đoạn": "GĐ2: Sản xuất & Setup",
        "Phòng ban": "Design",
        "Hạng mục công việc": "Chụp ảnh nền trắng / concept cho 2 dòng sản phẩm",
        "PIC": "Phạm Thị D",
        "Ngày bắt đầu": d(-20),
        "Deadline": d(-15),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD2_SanXuat'",
    },
    {
        "Mã Task": "GD2-02",
        "Giai đoạn": "GĐ2: Sản xuất & Setup",
        "Phòng ban": "Design",
        "Hạng mục công việc": "Thiết kế Banner sàn (Shopee, Lazada, TikTok Shop)",
        "PIC": "Phạm Thị D",
        "Ngày bắt đầu": d(-16),
        "Deadline": d(-11),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD2_SanXuat'",
    },
    {
        "Mã Task": "GD2-03",
        "Giai đoạn": "GĐ2: Sản xuất & Setup",
        "Phòng ban": "Content",
        "Hạng mục công việc": "Viết listing chuẩn SEO (tiêu đề, mô tả, bullet points)",
        "PIC": "Trần Thị B",
        "Ngày bắt đầu": d(-15),
        "Deadline": d(-10),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD2_SanXuat'",
    },
    {
        "Mã Task": "GD2-04",
        "Giai đoạn": "GĐ2: Sản xuất & Setup",
        "Phòng ban": "E-commerce",
        "Hạng mục công việc": "Đăng sản phẩm lên sàn (Shopee, Lazada, TikTok Shop)",
        "PIC": "Hoàng Văn E",
        "Ngày bắt đầu": d(-10),
        "Deadline": d(-7),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD2_SanXuat'",
    },

    # ── Giai đoạn 3: Teasing & Affiliate (D-7 → D-1) ──
    {
        "Mã Task": "GD3-01",
        "Giai đoạn": "GĐ3: Teasing & Affiliate",
        "Phòng ban": "Booking",
        "Hạng mục công việc": "Gửi PR Box cho KOC (unboxing & review)",
        "PIC": "Lê Văn C",
        "Ngày bắt đầu": d(-7),
        "Deadline": d(-5),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD3_Teasing'",
    },
    {
        "Mã Task": "GD3-02",
        "Giai đoạn": "GĐ3: Teasing & Affiliate",
        "Phòng ban": "Creative",
        "Hạng mục công việc": "Lên video teaser trên TikTok (countdown, sneak peek)",
        "PIC": "Trần Thị B",
        "Ngày bắt đầu": d(-6),
        "Deadline": d(-2),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD3_Teasing'",
    },
    {
        "Mã Task": "GD3-03",
        "Giai đoạn": "GĐ3: Teasing & Affiliate",
        "Phòng ban": "Vận hành",
        "Hạng mục công việc": "Thiết lập Voucher / Flash Sale trên các sàn",
        "PIC": "Hoàng Văn E",
        "Ngày bắt đầu": d(-5),
        "Deadline": d(-2),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD3_Teasing'",
    },
    {
        "Mã Task": "GD3-04",
        "Giai đoạn": "GĐ3: Teasing & Affiliate",
        "Phòng ban": "CSKH",
        "Hạng mục công việc": "Chuẩn bị FAQ & kịch bản trả lời cho CSKH",
        "PIC": "Võ Thị F",
        "Ngày bắt đầu": d(-4),
        "Deadline": d(-1),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD3_Teasing'",
    },

    # ── Giai đoạn 4: D-Day Mở bán bùng nổ (D-Day) ──
    {
        "Mã Task": "GD4-01",
        "Giai đoạn": "GĐ4: D-Day Mở bán bùng nổ",
        "Phòng ban": "Creative",
        "Hạng mục công việc": "Đồng loạt push video lên TikTok, Reels, YouTube Shorts",
        "PIC": "Trần Thị B",
        "Ngày bắt đầu": d(0),
        "Deadline": d(0),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD4_DDay'",
    },
    {
        "Mã Task": "GD4-02",
        "Giai đoạn": "GĐ4: D-Day Mở bán bùng nổ",
        "Phòng ban": "Booking",
        "Hạng mục công việc": "Push KOC lên bài kèm link Affiliate đồng loạt",
        "PIC": "Lê Văn C",
        "Ngày bắt đầu": d(0),
        "Deadline": d(0),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD4_DDay'",
    },
    {
        "Mã Task": "GD4-03",
        "Giai đoạn": "GĐ4: D-Day Mở bán bùng nổ",
        "Phòng ban": "Vận hành",
        "Hạng mục công việc": "Bật TikTok Ads / Shopee Ads chuyển đổi",
        "PIC": "Nguyễn Văn A",
        "Ngày bắt đầu": d(0),
        "Deadline": d(0),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD4_DDay'",
    },
    {
        "Mã Task": "GD4-04",
        "Giai đoạn": "GĐ4: D-Day Mở bán bùng nổ",
        "Phòng ban": "CSKH",
        "Hạng mục công việc": "Trực chat và chốt đơn liên tục (Shopee, Lazada, TikTok)",
        "PIC": "Võ Thị F",
        "Ngày bắt đầu": d(0),
        "Deadline": d(0),
        "Trạng thái": "To-do",
        "Tiến độ (%)": 0,
        "Link Sheet Chi tiết": "→ Sheet 'GD4_DDay'",
    },
]

# ============================================================
# 2. Tạo DataFrame và ghi ra Excel
# ============================================================

df = pd.DataFrame(tasks)

OUTPUT_FILE = "TIAN_Launch_MasterPlan_6Phases.xlsx"

with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
    df.to_excel(writer, sheet_name="Master Dashboard", index=False)

# ============================================================
# 3. Định dạng (format) bằng openpyxl
# ============================================================

wb = load_workbook(OUTPUT_FILE)
ws = wb["Master Dashboard"]

# --- 3a. Style cho header ---
header_font = Font(name="Arial", bold=True, color="FFFFFF", size=11)
header_fill = PatternFill(start_color="1F4E79", end_color="1F4E79", fill_type="solid")
header_alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)

thin_border = Border(
    left=Side(style="thin"),
    right=Side(style="thin"),
    top=Side(style="thin"),
    bottom=Side(style="thin"),
)

for col_idx in range(1, ws.max_column + 1):
    cell = ws.cell(row=1, column=col_idx)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = header_alignment
    cell.border = thin_border

# --- 3b. Style cho data rows ---
data_font = Font(name="Arial", size=10)
data_alignment = Alignment(vertical="center", wrap_text=True)

# Màu nền cho trạng thái
status_colors = {
    "To-do": PatternFill(start_color="BDD7EE", end_color="BDD7EE", fill_type="solid"),   # Xanh nhạt
    "Doing": PatternFill(start_color="FFE699", end_color="FFE699", fill_type="solid"),    # Vàng nhạt
    "Done": PatternFill(start_color="C6EFCE", end_color="C6EFCE", fill_type="solid"),     # Xanh lá nhạt
    "Overdue": PatternFill(start_color="FFC7CE", end_color="FFC7CE", fill_type="solid"),  # Đỏ nhạt
}

STATUS_COL = 8  # Cột "Trạng thái" (H)
PROGRESS_COL = 9  # Cột "Tiến độ (%)" (I)

for row_idx in range(2, ws.max_row + 1):
    for col_idx in range(1, ws.max_column + 1):
        cell = ws.cell(row=row_idx, column=col_idx)
        cell.font = data_font
        cell.alignment = data_alignment
        cell.border = thin_border

    # Tô màu cột Trạng thái
    status_cell = ws.cell(row=row_idx, column=STATUS_COL)
    status_val = status_cell.value
    if status_val in status_colors:
        status_cell.fill = status_colors[status_val]

    # Format cột Tiến độ (%)
    progress_cell = ws.cell(row=row_idx, column=PROGRESS_COL)
    progress_cell.number_format = '0"%"'
    progress_cell.alignment = Alignment(horizontal="center", vertical="center")

# --- 3c. Data Validation cho cột Trạng thái ---
dv = DataValidation(
    type="list",
    formula1='"To-do,Doing,Done,Overdue"',
    allow_blank=True,
    showDropDown=False,
)
dv.prompt = "Chọn trạng thái"
dv.promptTitle = "Trạng thái"
ws.add_data_validation(dv)
dv.add(f"H2:H1000")

# --- 3d. Điều chỉnh độ rộng cột ---
column_widths = {
    "A": 10,   # Mã Task
    "B": 32,   # Giai đoạn
    "C": 14,   # Phòng ban
    "D": 50,   # Hạng mục công việc
    "E": 16,   # PIC
    "F": 14,   # Ngày bắt đầu
    "G": 14,   # Deadline
    "H": 12,   # Trạng thái
    "I": 12,   # Tiến độ (%)
    "J": 22,   # Link Sheet Chi tiết
}

for col_letter, width in column_widths.items():
    ws.column_dimensions[col_letter].width = width

# --- 3e. Freeze header row ---
ws.freeze_panes = "A2"

# --- 3f. Tô màu xen kẽ nhóm Giai đoạn ---
odd_phase_fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")   # Xám nhạt (GĐ1, GĐ3)
even_phase_fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")   # Trắng   (GĐ2, GĐ4)

for row_idx in range(2, ws.max_row + 1):
    giai_doan = ws.cell(row=row_idx, column=2).value or ""
    is_odd_phase = any(tag in giai_doan for tag in ["GĐ1", "GĐ3"])
    fill = odd_phase_fill if is_odd_phase else even_phase_fill
    for col_idx in range(1, ws.max_column + 1):
        cell = ws.cell(row=row_idx, column=col_idx)
        # Không ghi đè màu trạng thái
        if col_idx != STATUS_COL:
            cell.fill = fill

# ============================================================
# 4. Lưu file
# ============================================================

wb.save(OUTPUT_FILE)
print(f"✅ File '{OUTPUT_FILE}' đã được tạo thành công!")
print(f"   - Sheet: 'Master Dashboard'")
print(f"   - Tổng số task: {len(tasks)}")
print(f"   - Giai đoạn 1: 3 tasks (D-30 → D-21) — Lên Concept & Chuẩn bị")
print(f"   - Giai đoạn 2: 4 tasks (D-20 → D-7)  — Sản xuất & Setup")
print(f"   - Giai đoạn 3: 4 tasks (D-7 → D-1)   — Teasing & Affiliate")
print(f"   - Giai đoạn 4: 4 tasks (D-Day)        — Mở bán bùng nổ")
print(f"   - D-Day giả định: {D_DAY.strftime('%Y-%m-%d')}")
