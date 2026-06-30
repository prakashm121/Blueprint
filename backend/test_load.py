import asyncio
import httpx
import time

URL = "http://127.0.0.1:8000/api/v1/auth/register"  # change this

payload = {
    "name": "test user",
    "email": "test@example.com",
    "password": "123456"
}

CONCURRENCY = 100


async def send_request(client, i):
    try:
        start = time.perf_counter()
        response = await client.post(URL, json={
            **payload,
            "email": f"test{i}@example.com"
        })
        end = time.perf_counter()

        return {
            "status": response.status_code,
            "time": end - start
        }
    except Exception as e:
        return {
            "status": "error",
            "time": None,
            "error": str(e)
        }


async def main():
    async with httpx.AsyncClient(timeout=30) as client:
        start = time.perf_counter()

        tasks = [send_request(client, i) for i in range(CONCURRENCY)]
        results = await asyncio.gather(*tasks)

        end = time.perf_counter()

    total_time = end - start

    success = [r for r in results if r["status"] in (200, 201)]
    failed = [r for r in results if r["status"] not in (200, 201)]

    avg_time = sum(r["time"] for r in success if r["time"]) / max(len(success), 1)

    print("\n===== LOAD TEST RESULTS =====")
    print(f"Total requests: {CONCURRENCY}")
    print(f"Total time: {total_time:.2f} sec")
    print(f"Success: {len(success)}")
    print(f"Failed: {len(failed)}")
    print(f"Avg response time: {avg_time:.4f} sec")


if __name__ == "__main__":
    asyncio.run(main())