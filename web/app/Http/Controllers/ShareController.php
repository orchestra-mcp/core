<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ShareController extends Controller
{
    /**
     * Display a shared document.
     *
     * Looks up the document by share_token or slug in the Supabase
     * shared_documents table, checks permissions, and renders the view.
     */
    public function show(Request $request, string $token)
    {
        $supabaseUrl = config('supabase.url');
        $supabaseKey = config('supabase.secret') ?: config('supabase.key');

        if (! $supabaseUrl || ! $supabaseKey) {
            abort(500, 'Supabase configuration missing.');
        }

        // Query by share_token first, then fall back to slug
        $response = Http::withHeaders([
            'apikey' => $supabaseKey,
            'Authorization' => 'Bearer '.$supabaseKey,
        ])->get("{$supabaseUrl}/rest/v1/shared_documents", [
            'or' => "(share_token.eq.{$token},slug.eq.{$token})",
            'select' => '*',
            'limit' => 1,
        ]);

        if ($response->failed() || empty($response->json())) {
            abort(404, 'Document not found.');
        }

        $doc = (object) $response->json()[0];

        // Check expiration
        if ($doc->expires_at && now()->isAfter($doc->expires_at)) {
            abort(410, 'This shared link has expired.');
        }

        // Check visibility permissions
        if ($doc->visibility === 'team') {
            if (! auth()->check()) {
                // Store intended URL and redirect to login
                session()->put('url.intended', $request->fullUrl());

                return redirect()->route('login')
                    ->with('message', 'Please sign in to view this team document.');
            }

            // Verify user belongs to the same organization
            $profileResponse = Http::withHeaders([
                'apikey' => $supabaseKey,
                'Authorization' => 'Bearer '.$supabaseKey,
            ])->get("{$supabaseUrl}/rest/v1/profiles", [
                'id' => 'eq.'.auth()->id(),
                'organization_id' => 'eq.'.$doc->organization_id,
                'select' => 'id',
                'limit' => 1,
            ]);

            if ($profileResponse->failed() || empty($profileResponse->json())) {
                abort(403, 'You do not have access to this document.');
            }
        }

        // Check password protection
        if ($doc->password_hash) {
            $sessionKey = 'share_unlocked_'.$doc->share_token;

            if (! session()->has($sessionKey)) {
                if ($request->isMethod('post')) {
                    return $this->verifyPassword($request, $doc);
                }

                return view('share.password', [
                    'token' => $token,
                    'title' => $doc->title,
                ]);
            }
        }

        // Increment view count (fire and forget)
        Http::withHeaders([
            'apikey' => $supabaseKey,
            'Authorization' => 'Bearer '.$supabaseKey,
            'Content-Type' => 'application/json',
        ])->post("{$supabaseUrl}/rest/v1/rpc/increment_shared_document_views", [
            'doc_token' => $doc->share_token,
        ]);

        return view('share.show', [
            'document' => $doc,
        ]);
    }

    /**
     * Verify the password for a password-protected document.
     */
    private function verifyPassword(Request $request, object $doc)
    {
        $request->validate([
            'password' => 'required|string',
        ]);

        $inputHash = hash('sha256', $request->input('password'));

        if ($inputHash !== $doc->password_hash) {
            return back()->withErrors(['password' => 'Incorrect password.']);
        }

        // Store unlock in session
        session()->put('share_unlocked_'.$doc->share_token, true);

        return redirect()->back();
    }
}
