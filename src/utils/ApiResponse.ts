// utils/apiResponse.ts

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

export const apiResponse = <T>(data: T, message = "OK", statusCode = 200) => {
  return {
    statusCode,
    body: {
      success: true,
      message,
      data,
    } as ApiResponse<T>,
  };
};
