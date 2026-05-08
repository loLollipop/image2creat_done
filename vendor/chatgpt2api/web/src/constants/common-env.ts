const basePath = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '')

const webConfig = {
    apiUrl:
        process.env.NODE_ENV === 'development'
            ? 'http://127.0.0.1:8000'
            : basePath,
    appVersion: process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0',
    basePath,
}

export default webConfig
