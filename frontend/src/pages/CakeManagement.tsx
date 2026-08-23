import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import 'react-datepicker/dist/react-datepicker.css';
import './CakeManagement.css';

interface CakeSize {
  id: number;
  size: string;
  stock: number;
  price: number;
  is_active?: number;
}

interface Cake {
  id: number;
  name: string;
  description: string;
  image: string;
  is_active?: number;
  date_mode?: 'standard' | 'custom';
  custom_dates?: string; // JSON array string
  sizes: CakeSize[];
}

const API_URL = import.meta.env.VITE_API_URL;
const FOLDER_URL = import.meta.env.VITE_FOLDER_URL;

export default function CakeManagement() {
  const [cakes, setCakes] = useState<Cake[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'add'>('list');
  const [editingCake, setEditingCake] = useState<Cake | null>(null);

  // 新しいケーキの状態
  const [newCake, setNewCake] = useState({
    name: '',
    description: '',
    image: '',
    is_active: true,
    date_mode: 'standard' as 'standard' | 'custom',
    custom_dates: [] as string[]
  });
  const [newSizes, setNewSizes] = useState<Omit<CakeSize, 'id'>[]>([
    { size: '', stock: 0, price: 0, is_active: 1 }
  ]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ケーキを読み込む
  const fetchCakes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/api/cake`);
      const data = await response.json();

      if (data.success && Array.isArray(data.cakes)) {
        setCakes(data.cakes);
      } else {
        throw new Error('予期しないレスポンス形式');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ケーキの読み込みエラー');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCakes();
  }, []);

  // 🔹 画像処理
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // 画像ファイルか確認
      if (!file.type.startsWith('image/')) {
        alert('画像ファイルを選択してください。');
        return;
      }

      // ファイルサイズを確認（最大5MB）
      if (file.size > 5 * 1024 * 1024) {
        alert('画像は5MB以下にしてください。');
        return;
      }

      setSelectedImage(file);

      // プレビューを作成
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // 🔹 フォームをクリア
  const clearForm = () => {
    setNewCake({ name: '', description: '', image: '', is_active: true, date_mode: 'standard', custom_dates: [] });
    setNewSizes([{ size: '', stock: 0, price: 0, is_active: 1 }]);
    setSelectedImage(null);
    setImagePreview(null);
  };

  // 🔹 新しいケーキを追加
  const handleAddCake = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setUploading(true);

      // データを検証
      if (!newCake.name.trim()) {
        alert('ケーキ名は必須です');
        setUploading(false);
        return;
      }

      // FormDataを使用してマルチパートデータとして送信
      const formData = new FormData();

      const validSizes = newSizes;
      const hasActiveSize = validSizes.some(size => size.is_active !== 0);

      if (newCake.is_active && !hasActiveSize) {
        alert('少なくとも1つのサイズが必要です');
        setUploading(false);
        return;
      }

      // テキストフィールドを追加
      formData.append('name', newCake.name.trim());
      formData.append('description', newCake.description?.trim() || '');
      formData.append('is_active', newCake.is_active ? '1' : '0');

      // サイズをJSON文字列として追加
      formData.append('sizes', JSON.stringify(validSizes));

      formData.append('date_mode', newCake.date_mode);
      formData.append('custom_dates', JSON.stringify(newCake.custom_dates));

      // 画像があれば追加
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      console.log('📦 Enviando FormData:');
      console.log('📦 name:', newCake.name);
      console.log('📦 sizes:', JSON.stringify(validSizes));
      console.log('📦 image:', selectedImage?.name);

      const response = await fetch(`${API_URL}/api/cake`, {
        method: 'POST',
        body: formData, // Não usar Content-Type header! O browser vai setar automaticamente com boundary
      });

      const data = await response.json();

      if (data.success) {
        alert('ケーキが正常に追加されました！');
        clearForm();
        setActiveTab('list');
        fetchCakes();
      } else {
        throw new Error(data.error || 'ケーキの追加に失敗しました');
      }
    } catch (err) {
      console.error('❌ Erro:', err);
      alert(err instanceof Error ? err.message : 'ケーキの追加に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // 🔹 ケーキを更新
  const handleUpdateCake = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!editingCake) return;

    try {
      setUploading(true);

      const validSizes = newSizes;
      const hasActiveSize = validSizes.some(size => size.is_active !== 0);

      if (newCake.is_active && !hasActiveSize) {
        alert('少なくとも1つのサイズが必要です');
        setUploading(false);
        return;
      }

      // FormDataを使用
      const formData = new FormData();

      formData.append('name', newCake.name.trim());
      formData.append('description', newCake.description?.trim() || '');
      formData.append('is_active', newCake.is_active ? '1' : '0');

      formData.append('sizes', JSON.stringify(validSizes));

      formData.append('date_mode', newCake.date_mode);
      formData.append('custom_dates', JSON.stringify(newCake.custom_dates));

      // 既存の画像ファイル名を送信
      if (newCake.image && !selectedImage) {
        formData.append('existingImage', newCake.image);
      }

      // 新しい画像があれば追加
      if (selectedImage) {
        formData.append('image', selectedImage);
      }

      console.log('📦 Update FormData:');
      console.log('📦 name:', newCake.name);
      console.log('📦 sizes:', JSON.stringify(validSizes));
      console.log('📦 new image:', selectedImage?.name);

      const response = await fetch(`${API_URL}/api/cake/${editingCake.id}`, {
        method: 'PUT',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        alert('ケーキが正常に更新されました！');
        setEditingCake(null);
        clearForm();
        setActiveTab('list');
        fetchCakes();
      } else {
        throw new Error(data.error || 'ケーキの更新に失敗しました');
      }
    } catch (err) {
      console.error('❌ Erro:', err);
      alert(err instanceof Error ? err.message : 'ケーキの更新に失敗しました');
    } finally {
      setUploading(false);
    }
  };

  // 🔹 新しいサイズを追加
  const addNewSize = () => {
    setNewSizes(prev => [...prev, { size: '', stock: 0, price: 0, is_active: 1 }]);
  };

  // 🔹 サイズを削除
  const removeSize = (index: number) => {
    if (newSizes.length > 1) {
      setNewSizes(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 🔹 サイズを更新
  const updateSize = (index: number, field: keyof Omit<CakeSize, 'id'>, value: string | number) => {
    setNewSizes(prev =>
      prev.map((size, i) =>
        i === index ? { ...size, [field]: field === 'is_active' ? value : field === 'size' ? value : Number(value) || 0 } : size
      )
    );
  };

  // 🔹 ケーキを削除
  const handleDeleteCake = async (cakeId: number) => {
    if (!confirm('このケーキを削除してもよろしいですか？')) return;

    try {
      const response = await fetch(`${API_URL}/api/cake/${cakeId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        alert('ケーキが正常に削除されました！');
        fetchCakes();
      } else {
        throw new Error(data.error || 'ケーキの削除に失敗しました');
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'ケーキの削除に失敗しました');
    }
  };

  // 🔹 ケーキを編集
  const handleEditCake = (cake: Cake) => {
    setEditingCake(cake);
    setNewCake({
      name: cake.name,
      description: cake.description || '',
      image: cake.image || '',
      is_active: String(cake.is_active) === '1',
      date_mode: cake.date_mode || 'standard',
      custom_dates: cake.custom_dates ? JSON.parse(cake.custom_dates) : []
    });
    setNewSizes(cake.sizes.length > 0 ? cake.sizes.map(s => ({ ...s, is_active: s.is_active === undefined ? 1 : s.is_active })) : [{ size: '', stock: 0, price: 0, is_active: 1 }]);
    setImagePreview(cake.image ? `${API_URL}/image/${FOLDER_URL}/${cake.image}` : null);
    setSelectedImage(null);
    setActiveTab('add');
  };

  if (loading) return <div className="loading">ケーキを読み込み中...</div>;
  if (error) return <div className="error">エラー: {error}</div>;

  return (
    <div className="cake-management">
      <h1>🎂 ケーキ管理</h1>

      {/* ナビゲーションタブ */}
      <div className="cake-tabs">
        <button
          className={`tab-cake-button ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          📋 ケーキ一覧
        </button>
        <button
          className={`tab-cake-button ${activeTab === 'add' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('add');
            setEditingCake(null);
            clearForm();
          }}
        >
          ➕ {editingCake ? 'ケーキを編集' : 'ケーキを追加'}
        </button>
      </div>

      {/* タブの内容 */}
      <div className="tab-content">
        {activeTab === 'list' && (
          <div className="cake-list-admin">
            <h2>登録済みケーキ一覧</h2>

            {cakes.length === 0 ? (
              <p className="no-cakes">登録されているケーキがありません。</p>
            ) : (
              <div className="cakes-grid">
                {cakes.map(cake => (
                  <div key={cake.id} className="cake-card">
                    <div className="cake-image">
                      {cake.image ? (
                        <img
                          src={`${API_URL}/image/${FOLDER_URL}/${cake.image}`}
                          alt={cake.name}
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/default-cake.jpg';
                          }}
                        />
                      ) : (
                        <div className="no-image">📷 画像なし</div>
                      )}
                    </div>

                    <div className='cake-info-actions'>
                      <div className="cake-info">
                        <h3>{cake.name} {String(cake.is_active) === '0' && <span style={{ color: 'red', fontSize: '0.8em' }}>(非アクティブ)</span>}</h3>
                        {cake.description && (
                          <p className="cake-description">{cake.description}</p>
                        )}

                        <div className="cake-sizes">
                          <h4>サイズ:</h4>
                          {cake.sizes.length === 0 ? (
                            <p className="no-sizes">登録されているサイズがありません</p>
                          ) : (
                            <ul>
                              {cake.sizes.map(size => (
                                <li key={size.id}>
                                  <span className="size-name" style={{ textDecoration: size.is_active === 0 ? 'line-through' : 'none', color: size.is_active === 0 ? '#999' : 'inherit' }}>
                                    {size.size} {size.is_active === 0 && '(無効)'}
                                  </span>
                                  <span className="size-details">
                                    在庫: {size.stock} | ¥{size.price.toLocaleString('ja-JP')}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>

                      <div className="cake-actions">
                        <button
                          className="edit-cake-btn"
                          onClick={() => handleEditCake(cake)}
                        >
                          ✏️ 編集
                        </button>
                        <button
                          className="delete-cake-btn"
                          onClick={() => handleDeleteCake(cake.id)}
                        >
                          🗑️ 削除
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="cake-form-container">
            <h2>{editingCake ? 'ケーキを編集' : '新しいケーキを追加'}</h2>

            <form onSubmit={editingCake ? handleUpdateCake : handleAddCake} className="cake-form" encType="multipart/form-data">
              <div className="form-group">
                <label htmlFor="name">ケーキ名 *</label>
                <input
                  type="text"
                  id="name"
                  value={newCake.name}
                  onChange={(e) => setNewCake(prev => ({ ...prev, name: e.target.value }))}
                  required
                  placeholder="例: チョコレートケーキ"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description">説明</label>
                <textarea
                  id="description"
                  value={newCake.description}
                  onChange={(e) => setNewCake(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="ケーキの説明（任意）"
                  rows={3}
                />
              </div>

              <div className="form-group checkbox-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={newCake.is_active}
                    onChange={(e) => setNewCake(prev => ({ ...prev, is_active: e.target.checked }))}
                    style={{ width: 'auto' }}
                  />
                  アクティブ (販売中)
                </label>
              </div>

              {/* 🔹 画像セクション */}
              <div className="form-group">
                <label htmlFor="image">ケーキ画像</label>
 
                {/* 画像プレビュー */}
                {(imagePreview || (editingCake && newCake.image && !selectedImage)) && (
                  <div className="image-preview">
                    <img
                      src={imagePreview || `${API_URL}/image/${FOLDER_URL}/${newCake.image}`}
                      alt="プレビュー"
                    />
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={() => {
                        setImagePreview(null);
                        setSelectedImage(null);
                        setNewCake(prev => ({ ...prev, image: '' }));
                      }}
                    >
                      ❌ 画像を削除
                    </button>
                  </div>
                )}

                {/* ファイル入力 */}
                <input
                  type="file"
                  id="image-upload"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="image-upload-input"
                />
                <label htmlFor="image-upload" className="image-upload-label">
                  📁 {selectedImage ? '画像が選択されました' : '画像を選択'}
                </label>

                {selectedImage && (
                  <div className="file-info">
                    <small>ファイル: {selectedImage.name}</small>
                    <small>サイズ: {(selectedImage.size / 1024 / 1024).toFixed(2)} MB</small>
                  </div>
                )}

                <small className="help-text">
                  対応形式: JPG, PNG, GIF。最大サイズ: 5MB
                </small>
              </div>

              {/* 🔹 予約日設定 */}
              <div className="form-group">
                <label>予約可能日の設定</label>
                <div className="date-mode-options" style={{ display: 'flex', gap: '20px', marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="date_mode"
                      value="standard"
                      checked={newCake.date_mode === 'standard'}
                      onChange={() => setNewCake(prev => ({ ...prev, date_mode: 'standard' }))}
                      style={{ width: 'auto' }}
                    />
                    標準 (定休日を除く)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}>
                    <input
                      type="radio"
                      name="date_mode"
                      value="custom"
                      checked={newCake.date_mode === 'custom'}
                      onChange={() => setNewCake(prev => ({ ...prev, date_mode: 'custom' }))}
                      style={{ width: 'auto' }}
                    />
                    限定日のみ
                  </label>
                </div>

                {newCake.date_mode === 'custom' && (
                  <div className="custom-dates-selector" style={{ background: '#f9f9f9', padding: '15px', borderRadius: '8px', border: '1px solid #ddd' }}>
                    <p style={{ margin: '0 0 10px 0', fontSize: '0.9em' }}>カレンダーから日付を選択して追加してください:</p>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      <DatePicker
                        onChange={(date) => {
                          if (date) {
                            const dateStr = format(date, 'yyyy-MM-dd');
                            if (!newCake.custom_dates.includes(dateStr)) {
                              setNewCake(prev => ({
                                ...prev,
                                custom_dates: [...prev.custom_dates, dateStr].sort()
                              }));
                            }
                          }
                        }}
                        locale={ja}
                        dateFormat="yyyy-MM-dd"
                        placeholderText="日付を選択"
                        className="date-input"
                      />
                      <div className="selected-dates-tags" style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {newCake.custom_dates.map(d => (
                          <span key={d} style={{ background: '#fff', border: '1px solid #ff9dbd', padding: '2px 8px', borderRadius: '15px', fontSize: '0.85em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            {d}
                            <button
                              type="button"
                              onClick={() => setNewCake(prev => ({ ...prev, custom_dates: prev.custom_dates.filter(cd => cd !== d) }))}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '0', fontSize: '1.2em', color: '#ff4d4d' }}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ケーキのサイズ */}
              <div className="sizes-section">
                <div className="sizes-header">
                  <h3>サイズと価格 *</h3>
                  <button type="button" onClick={addNewSize} className="add-size-btn">
                    ➕ サイズを追加
                  </button>
                </div>

                {newSizes.map((size, index) => (
                  <div key={index} className="size-row-admin">
                    <div className="size-input-group">
                      <label>サイズ</label>
                      <input
                        type="text"
                        value={size.size}
                        onChange={(e) => updateSize(index, 'size', e.target.value)}
                        placeholder="例: P, M, G, 1kg"
                      />
                    </div>

                    <div className="size-input-group">
                      <label>在庫</label>
                      <input
                        type="text"
                        value={size.stock}
                        onChange={(e) => updateSize(index, 'stock', e.target.value)}
                        min="0"
                        required
                      />
                    </div>

                    <div className="size-input-group">
                      <label>価格 (¥)</label>
                      <input
                        type="text"
                        value={size.price}
                        onChange={(e) => updateSize(index, 'price', e.target.value)}
                        min="0"
                        required
                      />
                    </div>

                    <div className="size-input-group checkbox-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', gap: '4px' }}>
                        <span>有効</span>
                        <input
                          type="checkbox"
                          checked={size.is_active !== 0}
                          onChange={(e) => updateSize(index, 'is_active', e.target.checked ? 1 : 0)}
                          style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                        />
                      </label>
                    </div>

                    {newSizes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSize(index)}
                        className="remove-size-btn"
                      >
                        ❌
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  className="submit-cake-btn"
                  disabled={uploading}
                >
                  {uploading ? '⏳ 処理中...' : editingCake ? '💾 ケーキを更新' : '➕ ケーキを追加'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('list');
                    setEditingCake(null);
                    clearForm();
                  }}
                  className="cancel-btn"
                  disabled={uploading}
                >
                  ↩️ 戻る
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}