/* Supabase-powered admin catalog for AFFANJALANBAIK.
 * Load Supabase JS v2 first, then this file, from index.html.
 * Set window.AFB_SUPABASE_URL and window.AFB_SUPABASE_ANON_KEY before loading this file.
 */
(() => {
  'use strict';

  const url = window.AFB_SUPABASE_URL || '';
  const anonKey = window.AFB_SUPABASE_ANON_KEY || '';
  const clientFactory = window.supabase && window.supabase.createClient;
  const supabase = url && anonKey && clientFactory
    ? clientFactory(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
    : null;

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);

  function setNotice(message, isError = false) {
    const node = document.getElementById('afbAdminNotice');
    if (!node) return;
    node.textContent = message;
    node.style.color = isError ? '#b42318' : '#258a55';
  }

  function pageShell(content) {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = `<section class="container" style="padding:36px 0 64px;max-width:760px">
      <p class="eyebrow">Store management</p><h1 class="page-h1">Beat admin</h1>${content}</section>`;
  }

  function loginForm() {
    pageShell(`<div class="notice" style="margin:20px 0">Sign in with an admin account created in Supabase Auth and listed in public.admin_users.</div>
      <form id="afbAdminLogin" class="form" autocomplete="on">
        <div class="field"><label for="afbAdminEmail">Email</label><input id="afbAdminEmail" name="email" type="email" autocomplete="username" required></div>
        <div class="field"><label for="afbAdminPassword">Password</label><input id="afbAdminPassword" name="password" type="password" autocomplete="current-password" required></div>
        <p id="afbAdminNotice" role="status" aria-live="polite"></p>
        <button class="btn btn-primary" type="submit">Sign in</button>
      </form>`);
    document.getElementById('afbAdminLogin').addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!supabase) return setNotice('Set the Supabase project URL and public anon key in index.html first.', true);
      const form = new FormData(event.currentTarget);
      const { error } = await supabase.auth.signInWithPassword({ email: form.get('email'), password: form.get('password') });
      if (error) return setNotice(error.message, true);
      await renderAdmin();
    });
  }

  async function requireAdmin() {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return false;
    const { data, error } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error) throw error;
    return Boolean(data);
  }

  async function uploadFile(bucket, file) {
    if (!file) return null;
    const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, '-');
    const path = `${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  async function loadProducts() {
    const { data, error } = await supabase.from('products').select('id,slug,title,genre,bpm,key,price,art_url,preview_url,status,created_at').order('created_at', { ascending: false });
    if (error) throw error;
    const table = document.getElementById('afbProducts');
    table.innerHTML = data.length ? data.map((product) => `<article class="info-card" style="margin:12px 0;display:grid;grid-template-columns:72px 1fr auto;align-items:center;gap:14px">
      ${product.art_url ? `<img src="${escapeHtml(product.art_url)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px">` : '<div style="width:72px;height:72px;background:#f0f1f2;border-radius:8px"></div>'}
      <div><strong>${escapeHtml(product.title)}</strong><div class="muted">${escapeHtml(product.genre)} · ${Number(product.bpm) || 0} BPM · ${escapeHtml(product.key)} · $${Number(product.price).toFixed(2)}</div><div class="muted">${escapeHtml(product.status)}</div></div>
      <button class="btn btn-outline btn-small" type="button" data-delete-product="${escapeHtml(product.id)}">Delete</button>
    </article>`).join('') : '<p class="notice">No beats yet. Use the form above to add your first beat.</p>';
    table.querySelectorAll('[data-delete-product]').forEach((button) => {
      button.addEventListener('click', async () => {
        if (!window.confirm('Delete this beat from the catalog?')) return;
        const { error: deleteError } = await supabase.from('products').delete().eq('id', button.dataset.deleteProduct);
        if (deleteError) return setNotice(deleteError.message, true);
        await loadProducts();
        setNotice('Beat deleted.');
      });
    });
  }

  async function renderAdmin() {
    try {
      if (!(await requireAdmin())) return loginForm();
    } catch (error) {
      loginForm();
      return setNotice(error.message, true);
    }

    pageShell(`<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0"><p id="afbAdminNotice" role="status" aria-live="polite">Signed in. Add catalog details and optional cover art / audio preview.</p><button id="afbAdminLogout" class="btn btn-outline btn-small" type="button">Sign out</button></div>
      <form id="afbProductForm" class="form" enctype="multipart/form-data">
        <div class="form-grid">
          <div class="field"><label for="afbTitle">Beat title</label><input id="afbTitle" name="title" required maxlength="100"></div>
          <div class="field"><label for="afbGenre">Genre</label><input id="afbGenre" name="genre" required maxlength="80"></div>
          <div class="field"><label for="afbBpm">BPM</label><input id="afbBpm" name="bpm" type="number" min="1" max="400" required></div>
          <div class="field"><label for="afbKey">Key</label><input id="afbKey" name="key" required maxlength="10"></div>
          <div class="field"><label for="afbPrice">Price (USD)</label><input id="afbPrice" name="price" type="number" min="0.01" step="0.01" required></div>
          <div class="field"><label for="afbSlug">URL slug (optional)</label><input id="afbSlug" name="slug" maxlength="100" placeholder="generated-from-title"></div>
        </div>
        <div class="field"><label for="afbDescription">Description</label><textarea id="afbDescription" name="description" maxlength="2000"></textarea></div>
        <div class="field"><label for="afbArt">Cover art (JPG, PNG, WebP; max 5 MB)</label><input id="afbArt" name="art" type="file" accept="image/jpeg,image/png,image/webp"></div>
        <div class="field"><label for="afbPreview">Audio preview (MP3, WAV, OGG; max 20 MB)</label><input id="afbPreview" name="preview" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4"></div>
        <p class="notice">Upload only watermarked/short preview audio here. Keep full, paid master files private and deliver them through a verified payment backend.</p>
        <button class="btn btn-primary" type="submit">Save beat</button>
      </form>
      <h2 style="margin-top:32px">Catalog</h2><div id="afbProducts" aria-live="polite"></div>`);

    document.getElementById('afbAdminLogout').addEventListener('click', async () => {
      await supabase.auth.signOut();
      loginForm();
    });

    document.getElementById('afbProductForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = event.currentTarget.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const formData = new FormData(event.currentTarget);
        const title = String(formData.get('title')).trim();
        const slug = String(formData.get('slug') || title).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const artFile = formData.get('art');
        const previewFile = formData.get('preview');
        if (artFile?.size > 5 * 1024 * 1024) throw new Error('Cover image is larger than 5 MB.');
        if (previewFile?.size > 20 * 1024 * 1024) throw new Error('Audio preview is larger than 20 MB.');
        if (artFile?.size && !['image/jpeg', 'image/png', 'image/webp'].includes(artFile.type)) throw new Error('Cover must be JPG, PNG, or WebP.');
        if (previewFile?.size && !['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'].includes(previewFile.type)) throw new Error('Preview must be MP3, WAV, OGG, or M4A.');
        const artUrl = await uploadFile('beat-art', artFile?.size ? artFile : null);
        const previewUrl = await uploadFile('beat-previews', previewFile?.size ? previewFile : null);
        const { error } = await supabase.from('products').insert([{
          slug,
          title,
          genre: String(formData.get('genre')).trim(),
          bpm: Number(formData.get('bpm')),
          key: String(formData.get('key')).trim(),
          price: Number(formData.get('price')),
          description: String(formData.get('description') || '').trim(),
          art_url: artUrl,
          preview_url: previewUrl,
          status: 'active'
        }]);
        if (error) throw error;
        event.currentTarget.reset();
        setNotice('Beat saved to Supabase.');
        await loadProducts();
      } catch (error) {
        setNotice(error.message || 'Could not save beat.', true);
      } finally {
        button.disabled = false;
      }
    });

    try { await loadProducts(); }
    catch (error) { setNotice(error.message || 'Could not load catalog.', true); }
  }

  function handleAdminRoute() {
    const hash = window.location.hash.split('?')[0];
    if (hash === '#/admin') renderAdmin();
  }

  window.addEventListener('hashchange', handleAdminRoute);
  document.addEventListener('DOMContentLoaded', handleAdminRoute);
})();
