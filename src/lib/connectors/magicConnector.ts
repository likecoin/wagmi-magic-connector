import { type EthNetworkConfiguration, type Magic } from 'magic-sdk';
import { type Chain, createWalletClient, custom, getAddress } from 'viem';

export const IS_SERVER = typeof window === 'undefined';

type EthereumProvider = { request(...args: any): Promise<any> };

export interface MagicOptions {
  apiKey: string;
  accentColor?: string;
  isDarkMode?: boolean;
  isCustomModal?: boolean;
  customLogo?: string;
  customHeaderText?: string;
  connectorType?: 'dedicated' | 'universal';
  magicSdkConfiguration?: any;
  networks?: EthNetworkConfiguration[];
}

/**
 * Magic Connector class is a base class for Dedicated Wallet and Universal Wallet Connectors
 * It implements the common functionality of both the connectors
 *
 * Dedicated Wallet Connector and Universal Wallet Connector are the two connectors provided by this library
 * And both of them extend this class.
 */

export interface MagicConnectorParams {
  chains: readonly Chain[];
  options: MagicOptions;
}

export function magicConnector({ chains = [], options }: MagicConnectorParams) {
  if (!options.apiKey) {
    throw new Error('Magic API Key is required. Get one at https://dashboard.magic.link/');
  }

  let magicInstance: Magic | null = null;

  const getMagicSDK = async (): Promise<Magic> => {
    if (magicInstance) return magicInstance;

    const [{ Magic: MagicConstructor }, { OAuthExtension }] = await Promise.all([
      import('magic-sdk'),
      import('@magic-ext/oauth2'),
    ]);

    magicInstance = new MagicConstructor(options.apiKey, {
      ...options.magicSdkConfiguration,
      extensions: [new OAuthExtension()],
    });

    return magicInstance;
  };

  const getProvider = async () => {
    const magic = await getMagicSDK();
    if (!magic) return null;
    return magic.rpcProvider;
  };

  const getAccount = async () => {
    const provider = await getProvider();
    const accounts = await provider?.send('eth_accounts', []);
    const account = getAddress(accounts[0] as string);
    return account;
  };

  const getWalletClient = async ({ chainId }: { chainId?: number } = {}) => {
    const provider = (await getProvider()) as unknown as EthereumProvider;
    const account = await getAccount();
    const chain = chains.find(x => x.id === chainId) ?? chains[0];
    if (!provider) throw new Error('provider is required.');
    return createWalletClient({
      account,
      chain,
      transport: custom(provider),
    });
  };

  const onAccountsChanged = async (accounts: string[]) => {
    const provider = await getProvider();
    if (accounts.length === 0 || !accounts[0]) provider?.emit('disconnect');
    else provider?.emit('change', { account: getAddress(accounts[0]) });
  };

  return {
    id: 'magic',
    name: 'Magic',
    type: 'Magic',
    isModalOpen: false,
    isReady: IS_SERVER,
    getProvider,
    getMagicSDK,
    getAccount,
    getWalletClient,
    onAccountsChanged,
  };
}
