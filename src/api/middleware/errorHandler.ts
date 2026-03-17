// src/api/middleware/errorHandler.ts

import type { Context } from 'hono';

export function errorHandler(err: any) {
  console.error('Error:', err);

  if (err.message === 'UNAUTHORIZED') {
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন।',
        details: {},
      },
    };
  }

  if (err.message === 'FORBIDDEN') {
    return {
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'আপনার এই অ্যাকশন সম্পাদনের অনুমতি নেই।',
        details: {},
      },
    };
  }

  if (err.message === 'NOT_FOUND') {
    return {
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'অনুরোধকৃত সংস্থান খুঁজে পাওয়া যায়নি।',
        details: {},
      },
    };
  }

  if (err.message === 'VALIDATION_ERROR') {
    return {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'বৈধতা ত্রুটি।',
        details: err.details || {},
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'অভ্যন্তরীণ সার্ভার ত্রুটি।',
      details: {},
    },
  };
}

export function createErrorResponse(
  code: string,
  messageBn: string,
  messagesEn?: string,
  statusCode: number = 400
) {
  return {
    statusCode,
    body: {
      success: false,
      error: {
        code,
        message: messageBn,
        message_en: messagesEn,
      },
    },
  };
}
