import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigService {
  // get env var, provide default
  getVar(k: string, d?: string | null): string {
    let v: string;
    v = process.env[k];
    if (v.length === 0 && d !== null) {
      v = d;
    }
    return v;
  }
  // get env var, raise error if missing
  getVarErr(k: string): string {
    let v: string;
    v = process.env[k];
    if (!v || v.length === 0) {
      console.log(`failed to get env var ${k}`)
      throw new Error('No environment variable named: ' + k);
    }
    return v;
  }
}
