import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, LayoutGrid, List, AlertCircle, Upload } from 'lucide-react';
import { StatusBadge } from '../components/admin/StatusBadge';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../components/ui/alert-dialog';
import {
  ApiError,
  createProductApi,
  deleteProductApi,
  fetchProductsApi,
  ProductRecord,
  updateProductApi,
} from '../services/api';

type ProductFormState = {
  name: string;
  description: string;
  category: string;
  status: string;
  price: string;
  stock: string;
  sku: string;
  image: string;
};

const DEFAULT_PRODUCT_IMAGE = '\uD83D\uDCE6';

const defaultProductForm: ProductFormState = {
  name: '',
  description: '',
  category: 'Electronique',
  status: 'available',
  price: '',
  stock: '',
  sku: '',
  image: DEFAULT_PRODUCT_IMAGE,
};

const baseCategoryOptions = ['Electronique', 'Mode', 'Maison', 'Sports'];

const fallbackProducts: ProductRecord[] = [
  { id: '1', name: 'MacBook Pro 16"', price: 2499, stock: 45, views: 1234, status: 'available', category: 'Electronique', updated: '2 Mar 2026', image: '💻' },
  { id: '2', name: 'iPhone 15 Pro', price: 1199, stock: 8, views: 2341, status: 'low_stock', category: 'Electronique', updated: '1 Mar 2026', image: '📱' },
  { id: '3', name: 'AirPods Pro', price: 249, stock: 0, views: 890, status: 'out_of_stock', category: 'Electronique', updated: '28 Fev 2026', image: '🎧' },
  { id: '4', name: 'Magic Mouse', price: 99, stock: 67, views: 456, status: 'available', category: 'Electronique', updated: '3 Mar 2026', image: '🖱️' },
  { id: '5', name: 'T-shirt Premium', price: 45, stock: 120, views: 678, status: 'available', category: 'Mode', updated: '3 Mar 2026', image: '👕' },
  { id: '6', name: 'Sneakers Sport', price: 89, stock: 3, views: 1456, status: 'low_stock', category: 'Mode', updated: '2 Mar 2026', image: '👟' },
];

function isAuthError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (((error as ApiError).status || 0) === 401 || ((error as ApiError).status || 0) === 403)
  );
}

function resolveStatusLabel(status: string, short = false): string {
  if (status === 'available') return short ? 'Dispo' : 'Disponible';
  if (status === 'low_stock') return short ? 'Faible' : 'Stock faible';
  if (status === 'hidden') return 'Masque';
  return short ? 'Rupture' : 'Rupture';
}

function resolveStatusType(status: string): 'success' | 'warning' | 'danger' {
  if (status === 'available') return 'success';
  if (status === 'low_stock' || status === 'hidden') return 'warning';
  return 'danger';
}

function getTodayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

function isImageSource(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed);
}

function isInlineImageData(value: string): boolean {
  return value.trim().startsWith('data:image/');
}

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire ce fichier image.'));
    reader.readAsDataURL(file);
  });
}

export function ProductsPage() {
  const [products, setProducts] = useState<ProductRecord[]>(fallbackProducts);
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<ProductRecord | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDragOverImage, setIsDragOverImage] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [productForm, setProductForm] = useState<ProductFormState>(defaultProductForm);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const categoryOptions = useMemo(
    () => Array.from(new Set([...baseCategoryOptions, ...products.map((product) => product.category).filter(Boolean)])),
    [products]
  );

  useEffect(() => {
    let active = true;

    const loadProducts = async () => {
      try {
        const apiProducts = await fetchProductsApi();
        if (active) {
          setProducts(apiProducts);
          setLoadError('');
        }
      } catch (_error) {
        if (active) {
          setLoadError('Impossible de charger les produits depuis le serveur. Donnees locales affichees.');
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadProducts();
    return () => {
      active = false;
    };
  }, []);

  const lowStockCount = products.filter((p) => p.status === 'low_stock' || p.status === 'out_of_stock').length;

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetProductForm = () => {
    setProductForm(defaultProductForm);
  };

  const closeProductDialog = () => {
    setIsAddingProduct(false);
    setEditingProduct(null);
    resetProductForm();
  };

  const openAddProductDialog = () => {
    setLoadError('');
    setEditingProduct(null);
    resetProductForm();
    setIsAddingProduct(true);
  };

  const openEditProductDialog = (product: ProductRecord) => {
    setLoadError('');
    setIsAddingProduct(false);
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      description: '',
      category: product.category || 'Electronique',
      status: product.status || 'available',
      price: String(product.price),
      stock: String(product.stock),
      sku: '',
      image: product.image || DEFAULT_PRODUCT_IMAGE,
    });
  };

  const deriveStatusFromForm = (stock: number, currentStatus: string) => {
    if (currentStatus === 'available' || currentStatus === 'low_stock' || currentStatus === 'out_of_stock' || currentStatus === 'hidden') {
      return currentStatus;
    }
    if (stock <= 0) return 'out_of_stock';
    if (stock < 10) return 'low_stock';
    return 'available';
  };

  const handleSaveProduct = async () => {
    const name = productForm.name.trim();
    const category = productForm.category.trim();
    const image = productForm.image.trim() || editingProduct?.image || DEFAULT_PRODUCT_IMAGE;
    const price = Number(productForm.price);
    const stock = Number(productForm.stock);

    if (!name) {
      setLoadError('Le nom du produit est obligatoire.');
      return;
    }
    if (!category) {
      setLoadError('La categorie est obligatoire.');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setLoadError('Le prix doit etre un nombre positif.');
      return;
    }
    if (!Number.isFinite(stock) || stock < 0) {
      setLoadError('Le stock doit etre un nombre positif.');
      return;
    }

    const normalizedPayload: Omit<ProductRecord, 'id'> = {
      name,
      category,
      image,
      price,
      stock,
      status: deriveStatusFromForm(stock, productForm.status),
      views: editingProduct?.views || 0,
      updated: getTodayStamp(),
    };

    setIsSavingProduct(true);

    if (editingProduct) {
      const nextLocalProduct: ProductRecord = { ...editingProduct, ...normalizedPayload };
      try {
        const updated = await updateProductApi(editingProduct.id, normalizedPayload);
        setProducts((prev) => prev.map((product) => (product.id === editingProduct.id ? updated : product)));
        setLoadError('');
        closeProductDialog();
      } catch (error) {
        if (isAuthError(error)) {
          setLoadError('Vous n avez pas les permissions pour modifier ce produit.');
          return;
        }
        setProducts((prev) => prev.map((product) => (product.id === editingProduct.id ? nextLocalProduct : product)));
        setLoadError('Produit modifie localement, mais la synchronisation serveur a echoue.');
        closeProductDialog();
      } finally {
        setIsSavingProduct(false);
      }
      return;
    }

    const localProduct: ProductRecord = {
      id: `local_${Date.now().toString(36)}`,
      ...normalizedPayload,
    };

    try {
      const created = await createProductApi(normalizedPayload);
      setProducts((prev) => [created, ...prev]);
      setLoadError('');
      closeProductDialog();
    } catch (error) {
      if (isAuthError(error)) {
        setLoadError('Vous n avez pas les permissions pour ajouter un produit.');
        return;
      }
      setProducts((prev) => [localProduct, ...prev]);
      setLoadError('Produit ajoute localement, mais la synchronisation serveur a echoue.');
      closeProductDialog();
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;

    const targetId = productToDelete;
    const previousProducts = products;

    setProductToDelete(null);
    setProducts((prev) => prev.filter((product) => product.id !== targetId));

    try {
      await deleteProductApi(targetId);
      setLoadError('');
    } catch (error) {
      if (isAuthError(error)) {
        setProducts(previousProducts);
        setLoadError('Vous n avez pas les permissions pour supprimer ce produit.');
        return;
      }
      setLoadError('Produit supprime localement, mais la synchronisation serveur a echoue.');
    }
  };

  const applyImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setLoadError('Fichier invalide: veuillez choisir une image PNG, JPG, JPEG ou WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLoadError('Image trop lourde: taille maximale 5MB.');
      return;
    }

    setIsUploadingImage(true);
    try {
      const dataUrl = await toDataUrl(file);
      setProductForm((prev) => ({ ...prev, image: dataUrl }));
      setLoadError('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Impossible de charger cette image.');
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleImageInputChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await applyImageFile(file);
    event.target.value = '';
  };

  const handleImageDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOverImage(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await applyImageFile(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1>Produits</h1>
          <p className="text-muted-foreground">Gerez votre catalogue de produits</p>
        </div>
        <Button onClick={openAddProductDialog} className="gap-2">
          <Plus size={16} />
          Ajouter un produit
        </Button>
      </div>

      {loadError && (
        <Card className="p-4 border-warning bg-warning/5">
          <p className="text-sm">{loadError}</p>
        </Card>
      )}

      {lowStockCount > 0 && (
        <Card className="p-4 border-warning bg-warning/5">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-warning mt-0.5" size={20} />
            <div className="flex-1">
              <p className="font-medium">Stock faible</p>
              <p className="text-sm text-muted-foreground">
                {lowStockCount} produit(s) necessitent un reapprovisionnement
              </p>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <Input
              placeholder="Rechercher par nom ou categorie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'table' ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setViewMode('table')}
            >
              <List size={18} />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'outline'}
              size="icon"
              onClick={() => setViewMode('grid')}
            >
              <LayoutGrid size={18} />
            </Button>
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">Chargement des produits...</p>
        </Card>
      ) : viewMode === 'table' ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Image</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Nom</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Prix</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Stock</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Vues</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Statut</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Derniere MAJ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-accent/50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="h-12 w-12 bg-muted rounded flex items-center justify-center text-2xl overflow-hidden">
                        {isImageSource(product.image) ? (
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          product.image
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium">EUR {product.price}</td>
                    <td className="py-3 px-4 text-sm text-right">
                      <span className={product.stock < 10 ? 'text-warning' : ''}>{product.stock}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right text-muted-foreground">{product.views}</td>
                    <td className="py-3 px-4">
                      <StatusBadge
                        status={resolveStatusLabel(product.status)}
                        type={resolveStatusType(product.status)}
                      />
                    </td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{product.updated}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openEditProductDialog(product)}>
                          Editer
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setProductToDelete(product.id)}>
                          Supprimer
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="p-4 hover:shadow-lg transition-shadow">
              <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-6xl mb-4 overflow-hidden">
                {isImageSource(product.image) ? (
                  <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  product.image
                )}
              </div>
              <div className="space-y-2">
                <h4 className="font-medium truncate">{product.name}</h4>
                <p className="text-xs text-muted-foreground">{product.category}</p>
                <div className="flex items-center justify-between">
                  <p className="text-lg font-semibold">EUR {product.price}</p>
                  <StatusBadge status={resolveStatusLabel(product.status, true)} type={resolveStatusType(product.status)} />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openEditProductDialog(product)}>
                    Editer
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => setProductToDelete(product.id)}>
                    Supprimer
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog
        open={isAddingProduct || !!editingProduct}
        onOpenChange={(open) => {
          if (!open) {
            closeProductDialog();
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProduct ? 'Editer le produit' : 'Ajouter un produit'}</DialogTitle>
            <DialogDescription>
              {editingProduct ? 'Modifiez les informations du produit ci-dessous.' : 'Remplissez les details pour creer un nouveau produit.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du produit</Label>
              <Input
                id="name"
                value={productForm.name}
                onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="ex: MacBook Pro 16"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={productForm.description}
                onChange={(event) => setProductForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="Description du produit..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Categorie</Label>
                <Select value={productForm.category} onValueChange={(value) => setProductForm((prev) => ({ ...prev, category: value }))}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Choisir une categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Statut</Label>
                <Select value={productForm.status} onValueChange={(value) => setProductForm((prev) => ({ ...prev, status: value }))}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Disponible</SelectItem>
                    <SelectItem value="low_stock">Stock faible</SelectItem>
                    <SelectItem value="out_of_stock">Rupture</SelectItem>
                    <SelectItem value="hidden">Masque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Prix (EUR)</Label>
                <Input
                  id="price"
                  type="number"
                  min="0"
                  value={productForm.price}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stock">Stock</Label>
                <Input
                  id="stock"
                  type="number"
                  min="0"
                  value={productForm.stock}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, stock: event.target.value }))}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={productForm.sku}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, sku: event.target.value }))}
                  placeholder="ABC123"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emoji">Image (emoji ou URL)</Label>
              <Input
                id="emoji"
                value={isInlineImageData(productForm.image) ? '' : productForm.image}
                onChange={(event) => setProductForm((prev) => ({ ...prev, image: event.target.value }))}
                placeholder={DEFAULT_PRODUCT_IMAGE}
              />
            </div>
            <div className="space-y-2">
              <Label>Images</Label>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                onChange={(event) => void handleImageInputChange(event)}
              />
              <div
                role="button"
                tabIndex={0}
                onClick={() => imageInputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    imageInputRef.current?.click();
                  }
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragOverImage(true);
                }}
                onDragLeave={() => setIsDragOverImage(false)}
                onDrop={(event) => void handleImageDrop(event)}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${isDragOverImage ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'}`}
              >
                <Upload className="mx-auto mb-2 text-muted-foreground" size={32} />
                <p className="text-sm text-muted-foreground">
                  {isUploadingImage ? 'Chargement de l image...' : 'Cliquer ou glisser des images ici'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PNG, JPG jusqu a 5MB</p>
              </div>
              {isImageSource(productForm.image) && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="h-40 w-full overflow-hidden rounded-md bg-background">
                    <img src={productForm.image} alt="Apercu image produit" className="h-full w-full object-cover" />
                  </div>
                  <div className="pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setProductForm((prev) => ({ ...prev, image: DEFAULT_PRODUCT_IMAGE }))}
                    >
                      Retirer l image
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeProductDialog}
            >
              Annuler
            </Button>
            <Button
              onClick={() => void handleSaveProduct()}
              disabled={isSavingProduct}
            >
              {isSavingProduct ? 'Sauvegarde...' : editingProduct ? 'Enregistrer' : 'Creer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!productToDelete} onOpenChange={() => setProductToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Etes-vous sur de vouloir supprimer ce produit ? Cette action est irreversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDeleteProduct()} className="bg-destructive text-destructive-foreground">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
