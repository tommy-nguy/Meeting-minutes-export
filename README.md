# Meeting-minutes-export

Giao diện mẫu để tải file audio và mô phỏng quá trình transcribe.

## Chạy thử

```bash
python3 -m http.server 8000
```

Sau đó mở `http://localhost:8000`.

## Tính năng

- Hiển thị trạng thái tiến trình/đang xử lý khi transcribe.
- Giới hạn dung lượng file < 50MB và hiển thị hướng dẫn.
- Cắt/chia đoạn audio trước khi gửi (tuỳ chọn) để tránh timeout.
