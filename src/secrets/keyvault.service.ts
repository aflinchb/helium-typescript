import * as keyvault from 'azure-keyvault';
import { Injectable, Inject } from '@nestjs/common';
import * as msrestazure from 'ms-rest-azure';
import { BunyanLogger } from '../logger/extlogger.service';
import { ConfigService } from '../config/config.service';

/**
 * Handles accessing secrets from Azure Key vault.
 */
@Injectable()
export class KeyVaultProvider {
  private client: keyvault.KeyVaultClient;
  url: string;
  clientId: string;
  clientSecret: string;
  tenantId: string;

  /**
   * Creates a new instance of the KeyVaultProvider class.
   * @param url The KeyVault URL
   * @param clientId The service principal client id that has 'secret read' access.
   * @param clientSecret The password for the provided service principal.
   * @param tenantId The id of the tenant that the service principal is a member of.
   */
  constructor(
    @Inject('BunyanLogger') private logger: BunyanLogger,
    @Inject('ConfigService') private config: ConfigService,
  ) {
    this.url = config.getVarErr('KEY_VAULT_URL');
    this.clientId = config.getVarErr('CLIENT_ID');
    this.clientSecret = config.getVarErr('CLIENT_SECRET');
    this.tenantId = config.getVarErr('TENANT_ID');
    this.logger = logger;
  }

  /**
   * Returns the latest version of the names secret.
   * @param name The name of the secret.
   */
  public async getSecret(name: string): Promise<string> {
    this.logger.Trace('In getSecret from KeyVault');
    if (this.client == null) {
      await this._initialize();
    }
    // An empty string for 'secretVersion' returns the latest version
    const secret = await this.client
      .getSecret(this.url, name, '')
      .then(s => s.value as string)
      .catch(_ => {
        this.logger.Error(Error(), 'Unable to find secret ' + name);
        throw new Error(`Unable to find secret ${name}`);
      });
    this.logger.Trace('Got secret from KeyVault');
    return secret;
  }

  /**
   * Initialized the KeyVault client.
   * This is handled in a separate method to avoid calling async operations in the constructor.
   */
  private async _initialize() {
    this.logger.Trace('Initializing KeyVault');
    // TODO (seusher): Validate MSI works with App Service containers
    const creds =
      this.clientId === undefined || this.clientId === ''
        ? await msrestazure.loginWithAppServiceMSI({
            resource: 'https://vault.azure.net'
          })
        : await msrestazure.loginWithServicePrincipalSecret(
            this.clientId,
            this.clientSecret,
            this.tenantId,
          );

    this.client = new keyvault.KeyVaultClient(creds);
  }
}
