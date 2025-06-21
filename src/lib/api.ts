
export interface OTPResponse {
  success: boolean;
  message: string;
  otp?: string;
  test_mode?: boolean;
}

export interface TokenOrderResponse {
  success: boolean;
  order_id: string;
  amount: number;
  currency: string;
  key: string;
  test_mode?: boolean;
}

export interface TokenVerificationResponse {
  success: boolean;
  message: string;
}

class CODVerifierAPI {
  private baseUrl: string;
  private nonce: string;

  constructor() {
    // Get the REST URL and nonce from the localized script
    this.baseUrl = (window as any).cod_verifier_ajax?.rest_url || '/wp-json/cod-verifier/v1/';
    this.nonce = (window as any).cod_verifier_ajax?.rest_nonce || '';
  }

  private async makeRequest<T>(endpoint: string, data: any): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-WP-Nonce': this.nonce,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Request failed');
    }

    return response.json();
  }

  async sendOTP(phone: string): Promise<OTPResponse> {
    return this.makeRequest<OTPResponse>('send-otp', { phone });
  }

  async verifyOTP(otp: string): Promise<OTPResponse> {
    return this.makeRequest<OTPResponse>('verify-otp', { otp });
  }

  async createTokenOrder(): Promise<TokenOrderResponse> {
    return this.makeRequest<TokenOrderResponse>('create-token-order', {});
  }

  async verifyTokenPayment(paymentData: {
    payment_id?: string;
    order_id?: string;
    signature?: string;
  }): Promise<TokenVerificationResponse> {
    return this.makeRequest<TokenVerificationResponse>('verify-token-payment', paymentData);
  }
}

export const api = new CODVerifierAPI();
