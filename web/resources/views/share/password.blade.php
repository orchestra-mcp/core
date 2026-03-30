<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#121212">
    <title>{{ $title }} - Password Required</title>
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700" rel="stylesheet">
    <style>
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
            height: 100%;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: hsl(0 0% 7.1%);
            color: hsl(0 0% 70.6%);
        }

        .password-page {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
        }

        .password-card {
            width: 100%;
            max-width: 400px;
            background: hsl(0 0% 12.9%);
            border: 1px solid hsl(0 0% 18%);
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }

        .password-icon {
            width: 48px;
            height: 48px;
            border-radius: 12px;
            background: hsl(277 100% 12%);
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 20px;
        }

        .password-title {
            text-align: center;
            font-size: 16px;
            font-weight: 600;
            color: hsl(0 0% 98%);
            margin-bottom: 6px;
        }

        .password-desc {
            text-align: center;
            font-size: 13px;
            color: hsl(0 0% 53.7%);
            margin-bottom: 24px;
        }

        .password-label {
            display: block;
            font-size: 11px;
            font-weight: 600;
            color: hsl(0 0% 53.7%);
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 6px;
        }

        .password-input {
            width: 100%;
            padding: 10px 14px;
            background: hsl(0 0% 9%);
            border: 1px solid hsl(0 0% 18%);
            border-radius: 6px;
            color: hsl(0 0% 98%);
            font-size: 14px;
            outline: none;
            transition: border-color 0.15s;
        }
        .password-input:focus {
            border-color: hsl(277 100% 50%);
            box-shadow: 0 0 0 1px hsla(277, 100%, 50%, 0.25);
        }

        .password-error {
            margin-top: 8px;
            font-size: 12px;
            color: hsl(10.2 77.9% 53.9%);
        }

        .password-submit {
            display: block;
            width: 100%;
            margin-top: 16px;
            padding: 10px 20px;
            background: hsl(277 100% 50%);
            color: #fff;
            border: none;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: filter 0.15s;
        }
        .password-submit:hover {
            filter: brightness(1.1);
        }

        .password-footer {
            text-align: center;
            margin-top: 20px;
            font-size: 11px;
            color: hsl(0 0% 30.2%);
        }
        .password-footer a {
            color: hsl(277 100% 65%);
            text-decoration: none;
        }
        .password-footer a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="password-page">
        <div class="password-card">
            <div class="password-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="hsl(277, 100%, 50%)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
            </div>

            <h1 class="password-title">{{ $title }}</h1>
            <p class="password-desc">This document is password protected. Enter the password to continue.</p>

            <form method="POST" action="{{ route('share.password', $token) }}">
                @csrf

                <label class="password-label" for="password">Password</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    class="password-input"
                    placeholder="Enter password..."
                    required
                    autofocus
                >

                @error('password')
                    <p class="password-error">{{ $message }}</p>
                @enderror

                <button type="submit" class="password-submit">Unlock Document</button>
            </form>

            <p class="password-footer">
                Shared via <a href="https://orchestra-mcp.dev">Orchestra MCP</a>
            </p>
        </div>
    </div>
</body>
</html>
