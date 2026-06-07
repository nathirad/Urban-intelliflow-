User avatars
============

Drop avatar images here and they appear automatically (square PNG, e.g. 256x256):

  citizen.png   → ผู้ใช้ทั่วไป (ประชาชน)
  officer.png   → เจ้าหน้าที่ / ตำรวจจราจร
  admin.png     → ผู้ดูแลระบบ

The <Avatar> component (frontend/src/components/Avatar.tsx) loads /avatars/{role}.png
and falls back to the user's initial if the file is missing. A per-user avatarUrl
(e.g. from a LINE/Google profile) takes priority when available.
