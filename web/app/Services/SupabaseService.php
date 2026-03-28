<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class SupabaseService
{
    private string $baseUrl;
    private string $serviceKey;

    public function __construct()
    {
        $this->baseUrl = config('services.supabase.url', 'http://localhost:54321');
        $this->serviceKey = config('services.supabase.service_key', '');
    }

    /**
     * Make authenticated request to Supabase REST API.
     */
    public function request(string $method, string $path, array $data = [], array $headers = [])
    {
        $url = rtrim($this->baseUrl, '/') . '/rest/v1/' . ltrim($path, '/');

        $defaultHeaders = [
            'apikey' => $this->serviceKey,
            'Authorization' => 'Bearer ' . $this->serviceKey,
            'Content-Type' => 'application/json',
            'Prefer' => 'return=representation',
        ];

        $response = Http::withHeaders(array_merge($defaultHeaders, $headers))
            ->$method($url, $data);

        if ($response->failed()) {
            throw new \RuntimeException("Supabase API error: " . $response->body());
        }

        return $response->json();
    }

    public function get(string $path, array $query = [])
    {
        return $this->request('get', $path . '?' . http_build_query($query));
    }

    public function post(string $path, array $data)
    {
        return $this->request('post', $path, $data);
    }

    public function patch(string $path, array $data)
    {
        return $this->request('patch', $path, $data);
    }

    public function delete(string $path)
    {
        return $this->request('delete', $path);
    }
}
