import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect } from 'react';

import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import { createModuleLogger } from '../../logging/logger';
import { useAppTheme } from '../theme/themeContext';

const log = createModuleLogger('shop-screen');

export function ShopScreen() {
  const { tokens } = useAppTheme();

  useEffect(() => {
    log.debug('Shop screen initialized');
  }, []);

  return (
    <ScreenScaffold>
      <ScreenHeader
        actions={<MainScreenActions />}
        title="Shop"
        titleIcon={
          <MaterialCommunityIcons
            color={tokens.textPrimary}
            name="shopping-outline"
            size={24}
          />
        }
      />
    </ScreenScaffold>
  );
}
