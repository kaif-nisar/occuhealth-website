import express from 'express';
import path from 'path';

export const configureStaticMiddleware = (directory) => {
    return express.static(directory, {
        setHeaders: (res, filePath) => {
            // Set proper MIME types
            if (filePath.endsWith('.js')) {
                res.set('Content-Type', 'text/javascript');
            } else if (filePath.endsWith('.css')) {
                res.set('Content-Type', 'text/css');
            }

            // Set caching headers
            res.set('Cache-Control', 'public, max-age=3600'); // 1 hour cache
            res.set('X-Content-Type-Options', 'nosniff');
        },
        fallthrough: true, // Continue to next middleware if file not found
        index: false, // Disable directory indexing
    });
};