# Chép bản phổ từ âm thanh · Góc Hợp Âm

Service Linux Python 3.11 dùng Spotify Basic Pitch 0.4.0 (TensorFlow Lite), FFmpeg và music21. `POST /transcribe` nhận một MP3/WAV tối đa 36 MiB và 180 giây, ghi MIDI tạm rồi trả MusicXML. `GET /healthz` báo sẵn sàng sau khi nạp mô hình.

## Chạy bằng Docker

Từ thư mục `ai_server`, tạo một token riêng và giữ nó ở trình quản lý bí mật nếu muốn tái sử dụng để nối với Sites.

```sh
export TRANSCRIBE_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(32))')"
docker compose up --build
```

Từ một terminal có cùng biến `TRANSCRIBE_TOKEN`, gửi tệp thử:

```sh
curl --fail-with-body -X POST \
  -H "Authorization: Bearer $TRANSCRIBE_TOKEN" \
  -F 'file=@piano.wav' \
  'http://127.0.0.1:8000/transcribe?bpm=120' \
  -o ban-pho.musicxml
```

API cũng nhận tệp thô với `Content-Type: audio/wav` hoặc `audio/mpeg`. Tempo dùng để chia ô nhịp, mặc định 120 BPM, khoảng 40–240 BPM. Kết quả dùng nhịp 4/4 mặc định. Ký hiệu hợp âm được suy ra từ các nốt đồng thời đủ rõ. Bản thu một nhạc cụ hoặc một giọng cho kết quả tốt hơn bản phối nhiều lớp.

## Chạy trên Linux bằng Python

Cài FFmpeg và Python 3.11. Từ thư mục gốc repo:

```sh
python3.11 -m venv .venv
. .venv/bin/activate
python -m pip install -r ai_server/requirements.txt
python -m pip install --no-deps basic-pitch==0.4.0
export TRANSCRIBE_TOKEN="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 NUMBA_NUM_THREADS=1 \
  python -m uvicorn ai_server.main:app --host 127.0.0.1 --port 8000
```

## Render/Railway và Sites

- Tạo Docker service với thư mục gốc `ai_server` và `Dockerfile` trong thư mục đó. Dùng `/healthz` làm đường dẫn kiểm tra. Container lắng nghe trên cổng `$PORT` do nhà cung cấp đặt.
- Đặt `TRANSCRIBE_TOKEN` trên service. Trong biến môi trường của Sites, đặt `AI_TRANSCRIBE_URL` thành địa chỉ HTTPS gốc của service và `AI_TRANSCRIBE_TOKEN` thành cùng token. Có thể dùng các giá trị này trong môi trường local của Worker để kiểm tra kết nối.
- Người dùng đăng nhập tài khoản Góc Hợp Âm, mở một bài rồi chọn **Tạo Sheet bằng AI**. Sites tải âm thanh vào R2 riêng và xóa tệp tạm khi yêu cầu kết thúc. Nếu quản lý bucket, có thể đặt vòng đời một ngày chỉ cho tiền tố `audio-sheet/tmp/` để dọn tệp còn lại khi phiên tải bị ngắt. Trang vẽ MusicXML bằng OSMD và có nút tải tệp.
