<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-[var(--text-main)]">解析工具</h1>
      <p class="text-[var(--text-sub)] mt-1">粘贴链接解析视频/图片/音频，支持抖音、小红书、快手、B站等平台</p>
    </div>

    <div class="glass-panel">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col md:flex-row gap-3">
          <div class="flex-1 relative">
            <input v-model="inputUrl" type="text" class="form-input w-full pl-11 pr-4" placeholder="粘贴视频/图文链接..." @keydown.enter="handleParse" :disabled="parsing" />
            <svg class="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </div>
          <button @click="handleParse" :disabled="parsing || !inputUrl.trim()" class="btn-soft flex items-center gap-2 whitespace-nowrap">
            {{ parsing ? '解析中...' : '解析' }}
          </button>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="text-xs text-[var(--text-sub)]">测试：</span>
          <button v-for="demo in demoLinks" :key="demo.label" @click="inputUrl=demo.url;handleParse()" class="text-xs px-2.5 py-1 rounded-full bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-sub)] hover:text-[var(--primary)] hover:border-[var(--primary)]">{{ demo.label }}</button>
        </div>
      </div>
    </div>

    <div v-if="parseError" class="glass-panel border-red-500/30 bg-red-500/5">
      <p class="text-sm text-red-500">{{ parseError }}</p>
    </div>

    <div v-if="result" class="glass-panel">
      <div class="flex items-start justify-between mb-4">
        <div class="flex items-center gap-3">
          <span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--primary)]/10 text-[var(--primary)]">{{ result.platform }}</span>
          <span v-if="parseDuration" class="text-xs text-[var(--text-sub)]">耗时 {{ parseDuration }}ms</span>
        </div>
        <button @click="result=null" class="p-1.5 rounded-lg hover:bg-[var(--bg-body)] text-[var(--text-sub)]"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
      <h2 class="text-lg font-semibold text-[var(--text-main)] mb-1">{{ result.title||'无标题' }}</h2>
      <p v-if="result.author" class="text-sm text-[var(--text-sub)]">@{{ result.author }}</p>
      <div v-if="result.cover_url" class="mt-3">
        <img :src="signedCoverUrl||getProxyUrl(result.cover_url)" class="w-full max-h-64 object-cover rounded-lg" />
      </div>
      <div v-if="result.video_url" class="mt-3">
        <video :src="signedVideoUrl||result.video_url" controls class="w-full max-h-96 rounded-lg bg-black"></video>
      </div>
      <div v-if="result.image_list?.length" class="mt-3">
        <div class="grid grid-cols-3 gap-3">
          <img v-for="(img,i) in result.image_list" :key="i" :src="signedImageUrls[i]||getProxyUrl(typeof img==='object'?img.url:img)" class="rounded-lg cursor-pointer" @click="previewImage(i)" />
        </div>
      </div>
    </div>

    <div v-if="previewingImage" class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" @click="previewingImage=null">
      <img :src="previewingImageUrl" class="max-w-full max-h-[90vh] object-contain" @click.stop />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'

const API_BASE = 'https://api.missonce.cc'
const inputUrl = ref('')
const parsing = ref(false)
const result = ref<any>(null)
const parseError = ref('')
const parseDuration = ref(0)
const signedVideoUrl = ref('')
const signedCoverUrl = ref('')
const signedImageUrls = ref<string[]>([])
const previewingImage = ref<string|null>(null)
const previewingImageUrl = ref('')

const demoLinks = [
  { label:'抖音', url:'https://v.douyin.com/iRNBho6M/' },
  { label:'小红书', url:'https://www.xiaohongshu.com/explore/' },
  { label:'快手', url:'https://v.kuaishou.com/' },
]

const getProxyUrl = async (url:string) => {
  if(!url)return''
  try{
    const r=await fetch(`${API_BASE}/api/getProxySign`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})})
    const d=await r.json()
    if(d.retcode===200&&d.data)return`${API_BASE}/api/proxyDownload?url=${encodeURIComponent(url)}&ts=${d.data.ts}&sign=${d.data.sign}`
  }catch(e){console.error(e)}
  return`${API_BASE}/api/proxyDownload?url=${encodeURIComponent(url)}`
}

const getProxyUrlSync = (url:string) => url?`${API_BASE}/api/proxyDownload?url=${encodeURIComponent(url)}`:'' 

const handleParse = async () => {
  if(!inputUrl.value.trim()||parsing.value)return
  parsing.value=true;parseError.value='';result.value=null
  const t0=Date.now()
  try{
    const r=await fetch(`${API_BASE}/api/parse`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:inputUrl.value.trim()})})
    const d=await r.json()
    parseDuration.value=Date.now()-t0
    if(d.succ&&d.data){
      result.value=d.data
      if(d.data.video_url)signedVideoUrl.value=await getProxyUrl(d.data.video_url)
      if(d.data.cover_url)signedCoverUrl.value=await getProxyUrl(d.data.cover_url)
      if(d.data.image_list?.length)signedImageUrls.value=await Promise.all(d.data.image_list.map((img:any)=>getProxyUrl(typeof img==='object'?img.url:img)))
      ElMessage.success(`解析成功 · ${d.data.platform}`)
    }else{parseError.value=d.retdesc||'解析失败'}
  }catch(e:any){parseError.value=e.message||'网络错误'}
  finally{parsing.value=false}
}

const previewImage = async (i:number) => {
  const img = result.value?.image_list?.[i]
  const url = typeof img==='object'?img.url:img
  previewingImageUrl.value = signedImageUrls.value[i] || getProxyUrlSync(url)
  previewingImage.value = url
}
</script>
