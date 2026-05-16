// Google Apps Script部署后的Web应用URL 
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz1P0MeoIfl5a0hqOF8y1UixzWkEVRvO9NghwSO8bizmAAqLAyETENHsxPtUtn_YDsaog/exec';

// GitHub 配置
const GITHUB_CONFIG = {
    owner: 'zhuh49092',
    repo: 'files',
    token: 'dEXcOV6Y0eyRnELD68zUtcHX74lknu31fi3c',
    branch: 'main'
};

// 生成唯一ID
function generateUniqueId() {
    const timestamp = new Date().getTime();
    const randomPart = Math.floor(Math.random() * 10000);
    return `${timestamp}-${randomPart}`;
}

function getEntryContext() {
    const params = new URLSearchParams(window.location.search);
    return {
        entryType: params.get('entry') || 'garden',
        keyId: params.get('key') || ''
    };
}

// 加载/隐藏提示
$(function() {
    $.showLoading = function(options) {
        const opts = options || {};
        const mode = opts.mode || 'overlay'; // overlay | toast
        const text = opts.text || '';

        // 避免重复堆叠：已有 loading 时复用同一层并更新文本/样式
        const existing = $('#loadingOverlay');
        if (existing.length > 0) {
            existing.attr('data-mode', mode);
            const label = existing.find('.loading-label');
            if (label.length > 0) {
                if (text) {
                    label.text(text).show();
                } else {
                    label.hide();
                }
            }
            return;
        }

        const overlay = $('<div id="loadingOverlay"></div>');
        if (mode === 'toast') {
            overlay.css({
                'position': 'fixed',
                'top': '50%',
                'left': '50%',
                'transform': 'translate(-50%, -50%)',
                'background-color': 'rgba(30, 30, 30, 0.72)',
                'color': '#fff',
                'padding': '12px 16px',
                'border-radius': '12px',
                'display': 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'gap': '10px',
                'z-index': '9999',
                'backdrop-filter': 'blur(2px)',
                'box-shadow': '0 4px 14px rgba(0,0,0,0.2)',
                'pointer-events': 'none'
            });
        } else {
            overlay.css({
                'position': 'fixed',
                'top': '0',
                'left': '0',
                'width': '100%',
                'height': '100%',
                'background-color': 'rgba(0, 0, 0, 0.5)',
                'display': 'flex',
                'align-items': 'center',
                'justify-content': 'center',
                'z-index': '9999'
            });
        }

        const spinner = $('<div id="loadingSpinner"></div>');
        spinner.css({
            'width': mode === 'toast' ? '18px' : '50px',
            'height': mode === 'toast' ? '18px' : '50px',
            'border': mode === 'toast' ? '2px solid rgba(255,255,255,0.35)' : '5px solid #f3f3f3',
            'border-top': mode === 'toast' ? '2px solid #fff' : '5px solid #3498db',
            'border-radius': '50%',
            'animation': 'spin 0.9s linear infinite',
            'flex-shrink': '0'
        });

        const loadingText = $('<div class="loading-label"></div>');
        if (text) {
            loadingText.text(text).css({
                'font-size': '14px',
                'line-height': '1.2',
                'white-space': 'nowrap'
            });
        } else {
            loadingText.hide();
        }

        if ($('#loadingSpinStyle').length === 0) {
            const style = $('<style id="loadingSpinStyle">').text(`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `);
            $('head').append(style);
        }

        overlay.attr('data-mode', mode);
        overlay.append(spinner, loadingText);
        $('body').append(overlay);

        if (mode !== 'toast') {
            $('body').css('overflow', 'hidden');
        }
    };
    $.hideLoading = function() {
        const mode = $('#loadingOverlay').attr('data-mode');
        $('#loadingOverlay').remove();
        if (mode !== 'toast') {
            $('body').css('overflow', 'auto');
        }
    };
});

// 上传图片到 GitHub（返回 Promise）
async function uploadImageToGitHub(content, picdata, fileName) {
    const path = Date.now() + '_' + fileName;
    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;
    try {
        $.showLoading();
        await $.ajax({
            url: url, method: 'PUT',
            headers: { 'Authorization': `token ghp_${GITHUB_CONFIG.token}`, 'Content-Type': 'application/json' },
            data: JSON.stringify({ message: '图片', content: picdata })
        });
        $.hideLoading();
        return { success: true, picurl: `https://raw.githubusercontent.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/main/${path}` };
    } catch (error) {
        $.hideLoading();
        return { success: false, message: error.responseJSON ? error.responseJSON.message : '未知错误' };
    }
}

// 压缩图片为 Base64
function compressImageToBase64(imageFile) {
    return new Promise((resolve, reject) => {
        const maxWidth = 1024, quality = 0.9;
        if (!imageFile.type.match('image.*')) { reject(new Error('请选择图片文件')); return; }
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width, height = img.height;
                    if (width > maxWidth) { height = Math.round(maxWidth * height / width); width = maxWidth; }
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1]);
                } catch (error) { reject(new Error('图片处理失败: ' + error.message)); }
            };
            img.onerror = function() { reject(new Error('图片加载失败')); };
            img.src = e.target.result;
        };
        reader.onerror = function() { reject(new Error('文件读取失败')); };
        reader.readAsDataURL(imageFile);
    });
}

// 提交数据（返回 Promise）
async function postData(maction, pdatas) {
    return new Promise((resolve, reject) => {
        if (maction === 'updatePosition') {
            $.showLoading({
                mode: 'toast',
                text: '花の位置をセーブ中……'
            });
        } else {
            $.showLoading();
        }
        fetch(SCRIPT_URL, {
            method: 'POST', mode: 'no-cors', cache: 'no-cache',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: maction, record: pdatas })
        }).then(() => { $.hideLoading(); resolve(pdatas); })
          .catch((error) => { $.hideLoading(); reject(error); });
    });
}

// 加载数据
async function getData(maction) {
    const url = new URL(SCRIPT_URL);
    url.searchParams.append('action', maction);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const result = await response.json();
    if (result.success) return result.data;
    throw new Error(result.message || '获取数据失败');
}

// 筛选数据
function filterData(data, _id) {
    return $.makeArray(data).filter(item => item.pid === _id);
}

// 点赞
async function PostLike(_id) {
    try {
        const params = new URLSearchParams(window.location.search);
        const entryType = params.get('entry') || 'garden';
        const keyId = params.get('key') || '';

        await postData('addlike', {
            id: _id,
            entry_type: entryType,
            key_id: keyId,
            name: window.getGardenAuthor ? window.getGardenAuthor() : ''
        });
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}
window.PostLike = PostLike;

// 评论
async function PostComment(_id, commentConent) {
    try {
        const params = new URLSearchParams(window.location.search);
        const entryType = params.get('entry') || 'garden';
        const keyId = params.get('key') || '';

        await postData('comment', {
            rid: _id,
            comment: commentConent,
            entry_type: entryType,
            key_id: keyId,
            name: window.getGardenAuthor ? window.getGardenAuthor() : ''
        });
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    }
}
window.PostComment = PostComment;

// 浏览（支持首页和稿件详情）
// _id: 稿件ID，首页访问时可传0或空
// entryType: 'home' 或 'garden'
async function ViewCard(_id, entryType){
    try {
        const params = new URLSearchParams(window.location.search);
        const urlEntryType = params.get('entry') || 'garden';
        const urlKeyId = params.get('key') || '';
        
        var data = await postData('view', {
            rid: _id || '',
            entry_type: urlEntryType,
            key_id: urlKeyId,
            name: window.getGardenAuthor ? window.getGardenAuthor() : ''
        });
        return { success: true };
    } catch (error) {
        return { success: false, message: error.message };
    } 	
}
window.ViewCard = ViewCard;
             