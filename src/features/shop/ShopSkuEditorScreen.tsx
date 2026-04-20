import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';

import { MainScreenActions } from '../../components/MainScreenActions';
import { ScreenBackFooter } from '../../components/ScreenBackFooter';
import { ScreenHeader } from '../../components/ScreenHeader';
import { ScreenScaffold } from '../../components/ScreenScaffold';
import {
  ActionPill,
  ActionPillRow,
  SectionLabel,
  StatusBadge,
} from '../../components/Skeleton';
import { Tile } from '../../components/Tile';
import { createModuleLogger } from '../../logging/logger';
import { useSharedStore } from '../../state/sharedStore';
import type { ShopSkuImageSnapshot } from '../../state/sharedTypes';
import { useParentSession } from '../parent/parentSessionContext';
import { useAppTheme, useThemedStyles } from '../theme/appTheme';
import { formatPointsLabel } from './shopModels';

const log = createModuleLogger('shop-sku-editor-screen');
const TARGET_ASPECT: [number, number] = [4, 3];

function buildImageDataUri(base64: string, mimeType: string) {
  return `data:${mimeType};base64,${base64}`;
}

export function ShopSkuEditorScreen() {
  const { skuId } = useLocalSearchParams<{ skuId?: string | string[] }>();
  const styles = useThemedStyles(createStyles);
  const { tokens } = useAppTheme();
  const router = useRouter();
  const { isParentUnlocked } = useParentSession();
  const createShopSku = useSharedStore((state) => state.createShopSku);
  const updateShopSku = useSharedStore((state) => state.updateShopSku);
  const resolvedSkuId = Array.isArray(skuId) ? skuId[0] : skuId;
  const existingSku = useSharedStore((state) =>
    resolvedSkuId
      ? (state.document.head.shop.skusById[resolvedSkuId] ?? null)
      : null,
  );
  const [name, setName] = useState('');
  const [pointCost, setPointCost] = useState('');
  const [image, setImage] = useState<ShopSkuImageSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const previewUri = useMemo(
    () => (image ? buildImageDataUri(image.base64, image.mimeType) : null),
    [image],
  );
  const isEditing = Boolean(existingSku);

  useEffect(() => {
    log.debug('Shop SKU editor screen initialized', {
      isEditing,
      skuId: resolvedSkuId ?? null,
    });
  }, [isEditing, resolvedSkuId]);

  useEffect(() => {
    if (!existingSku) {
      return;
    }

    setName(existingSku.name);
    setPointCost(String(existingSku.pointCost));
    setImage(existingSku.image);
  }, [existingSku]);

  const pickImage = async (source: 'camera' | 'library') => {
    setErrorMessage('');

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setErrorMessage(
        source === 'camera'
          ? 'Camera access is needed to capture a shop photo.'
          : 'Photo library access is needed to pick a shop photo.',
      );
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: TARGET_ASPECT,
            base64: true,
            mediaTypes: ['images'],
            quality: 0.7,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: TARGET_ASPECT,
            base64: true,
            mediaTypes: ['images'],
            quality: 0.7,
          });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    if (!asset?.base64 || !asset.width || !asset.height || !asset.mimeType) {
      setErrorMessage('That photo could not be prepared for the shop.');
      return;
    }

    setImage({
      aspectRatio: '4:3',
      base64: asset.base64,
      height: asset.height,
      mimeType: asset.mimeType,
      width: asset.width,
    });
  };

  const handleSave = () => {
    if (!isParentUnlocked) {
      router.navigate('/parent-unlock');
      return;
    }

    const parsedPointCost = Number(pointCost.trim());

    if (!Number.isInteger(parsedPointCost)) {
      setErrorMessage('Enter a whole-number point cost.');
      return;
    }

    if (!image) {
      setErrorMessage('Add a shop photo before saving.');
      return;
    }

    const result = existingSku
      ? updateShopSku(existingSku.id, {
          image,
          name,
          pointCost: parsedPointCost,
        })
      : createShopSku({
          image,
          name,
          pointCost: parsedPointCost,
        });

    if (!result.ok) {
      setErrorMessage(result.error);
      return;
    }

    router.back();
  };

  return (
    <ScreenScaffold footer={<ScreenBackFooter />}>
      <ScreenHeader
        actions={<MainScreenActions />}
        title={isEditing ? 'Edit Shop Item' : 'New Shop Item'}
        titleIcon={
          <MaterialCommunityIcons
            color={tokens.textPrimary}
            name={isEditing ? 'pencil-outline' : 'plus-box-outline'}
            size={24}
          />
        }
      />

      <Tile
        accessory={
          <StatusBadge
            label={isParentUnlocked ? 'Unlocked' : 'Locked'}
            tone={isParentUnlocked ? 'good' : 'warning'}
          />
        }
        title="Parent Access"
      >
        <Text style={styles.helperCopy}>
          Parent mode is required to save shop catalog changes.
        </Text>
      </Tile>

      <Tile title="Item Details">
        <View style={styles.fieldGroup}>
          <SectionLabel>Display Name</SectionLabel>
          <TextInput
            onChangeText={setName}
            placeholder="Movie night"
            placeholderTextColor={tokens.textMuted}
            style={styles.input}
            value={name}
          />
        </View>

        <View style={styles.fieldGroup}>
          <SectionLabel>Point Cost</SectionLabel>
          <TextInput
            keyboardType="number-pad"
            onChangeText={setPointCost}
            placeholder="20"
            placeholderTextColor={tokens.textMuted}
            style={styles.input}
            value={pointCost}
          />
          {Number.isInteger(Number(pointCost.trim())) ? (
            <Text style={styles.helperCopy}>
              Preview: {formatPointsLabel(Number(pointCost.trim()))}
            </Text>
          ) : null}
        </View>
      </Tile>

      <Tile title="Photo">
        <Text style={styles.helperCopy}>
          Capture or choose a photo, then crop it to the fixed 4:3 shop card
          shape.
        </Text>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.previewPlaceholder}>
            <MaterialCommunityIcons
              color={tokens.textMuted}
              name="image-outline"
              size={28}
            />
            <Text style={styles.helperCopy}>No photo selected yet.</Text>
          </View>
        )}
        <ActionPillRow>
          <ActionPill
            label="Use Camera"
            onPress={() => {
              void pickImage('camera');
            }}
          />
          <ActionPill
            label="Pick Photo"
            onPress={() => {
              void pickImage('library');
            }}
          />
        </ActionPillRow>
      </Tile>

      {errorMessage ? (
        <Tile muted title="Needs Attention">
          <Text style={styles.errorCopy}>{errorMessage}</Text>
        </Tile>
      ) : null}

      <Tile title="Save">
        <ActionPillRow>
          <ActionPill label="Cancel" onPress={() => router.back()} />
          <ActionPill
            label={isParentUnlocked ? 'Save Item' : 'Unlock To Save'}
            onPress={handleSave}
            tone="primary"
          />
        </ActionPillRow>
      </Tile>
    </ScreenScaffold>
  );
}

const createStyles = ({ tokens }: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    errorCopy: {
      color: tokens.critical,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    fieldGroup: {
      gap: 8,
    },
    helperCopy: {
      color: tokens.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    input: {
      backgroundColor: tokens.inputSurface,
      borderColor: tokens.border,
      borderRadius: 16,
      borderWidth: 1,
      color: tokens.textPrimary,
      fontSize: 16,
      fontWeight: '700',
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    previewImage: {
      aspectRatio: 4 / 3,
      borderRadius: 18,
      width: '100%',
    },
    previewPlaceholder: {
      alignItems: 'center',
      backgroundColor: tokens.controlSurface,
      borderRadius: 18,
      gap: 8,
      justifyContent: 'center',
      minHeight: 180,
      paddingHorizontal: 16,
      paddingVertical: 16,
    },
  });
