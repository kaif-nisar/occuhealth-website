function editorInit() {
            const {
            DecoupledEditor,
            Alignment,
            Autoformat,
            AutoImage,
            AutoLink,
            Autosave,
            BlockQuote,
            Bold,
            Code,
            CodeBlock,
            Essentials,
            FindAndReplace,
            FontBackgroundColor,
            FontColor,
            FontFamily,
            FontSize,
            GeneralHtmlSupport,
            Heading,
            Highlight,
            HorizontalLine,
            ImageBlock,
            ImageCaption,
            ImageInline,
            ImageInsert,
            ImageResize,
            ImageStyle,
            ImageTextAlternative,
            ImageToolbar,
            Indent,
            IndentBlock,
            Italic,
            Link,
            LinkImage,
            List,
            ListProperties,
            MediaEmbed,
            PageBreak,
            Paragraph,
            PasteFromOffice,
            RemoveFormat,
            SpecialCharacters,
            SpecialCharactersArrows,
            SpecialCharactersCurrency,
            SpecialCharactersEssentials,
            SpecialCharactersLatin,
            SpecialCharactersMathematical,
            SpecialCharactersText,
            Strikethrough,
            Subscript,
            Superscript,
            Table,
            TableCaption,
            TableCellProperties,
            TableColumnResize,
            TableProperties,
            TableToolbar,
            TextTransformation,
            TodoList,
            Underline,
            WordCount
        } = window.CKEDITOR;

        const editorConfig = {
            toolbar: {
                items: [
                    'undo', 'redo',
                    '|',
                    'heading',
                    '|',
                    'fontSize', 'fontFamily', 'fontColor', 'fontBackgroundColor',
                    '|',
                    'bold', 'italic', 'underline', 'strikethrough',
                    'subscript', 'superscript', 'code',
                    '|',
                    'link', 'insertImage', 'insertTable', 'mediaEmbed',
                    'blockQuote', 'codeBlock',
                    '|',
                    'alignment',
                    '|',
                    'bulletedList', 'numberedList', 'todoList',
                    'outdent', 'indent',
                    '|',
                    'specialCharacters', 'horizontalLine', 'pageBreak',
                    '|',
                    'highlight', 'removeFormat',
                    '|',
                    'findAndReplace'
                ],
                shouldNotGroupWhenFull: true
            },
            plugins: [
                Alignment,
                Autoformat,
                AutoImage,
                AutoLink,
                Autosave,
                BlockQuote,
                Bold,
                Code,
                CodeBlock,
                Essentials,
                FindAndReplace,
                FontBackgroundColor,
                FontColor,
                FontFamily,
                FontSize,
                GeneralHtmlSupport,
                Heading,
                Highlight,
                HorizontalLine,
                ImageBlock,
                ImageCaption,
                ImageInline,
                ImageInsert,
                ImageResize,
                ImageStyle,
                ImageTextAlternative,
                ImageToolbar,
                Indent,
                IndentBlock,
                Italic,
                Link,
                LinkImage,
                List,
                ListProperties,
                MediaEmbed,
                PageBreak,
                Paragraph,
                PasteFromOffice,
                RemoveFormat,
                SpecialCharacters,
                SpecialCharactersArrows,
                SpecialCharactersCurrency,
                SpecialCharactersEssentials,
                SpecialCharactersLatin,
                SpecialCharactersMathematical,
                SpecialCharactersText,
                Strikethrough,
                Subscript,
                Superscript,
                Table,
                TableCaption,
                TableCellProperties,
                TableColumnResize,
                TableProperties,
                TableToolbar,
                TextTransformation,
                TodoList,
                Underline,
                WordCount
            ],
            fontFamily: {
                options: [
                    'default',
                    'Arial, sans-serif',
                    'Georgia, serif',
                    'Times New Roman, serif',
                    'Courier New, monospace',
                    'Verdana, sans-serif',
                    'Comic Sans MS, cursive'
                ],
                supportAllValues: true
            },
            fontSize: {
                options: [10, 12, 14, 'default', 18, 20, 22, 24, 26, 28, 30],
                supportAllValues: true
            },
            heading: {
                options: [
                    { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                    { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
                    { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                    { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
                    { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
                    { model: 'heading5', view: 'h5', title: 'Heading 5', class: 'ck-heading_heading5' },
                    { model: 'heading6', view: 'h6', title: 'Heading 6', class: 'ck-heading_heading6' }
                ]
            },
            htmlSupport: {
                allow: [
                    {
                        name: /.*/,
                        attributes: true,
                        classes: true,
                        styles: true
                    }
                ]
            },
            image: {
                toolbar: [
                    'imageTextAlternative', 'toggleImageCaption',
                    '|',
                    'imageStyle:inline', 'imageStyle:block', 'imageStyle:side',
                    '|',
                    'resizeImage'
                ]
            },
            initialData: ``,
            link: {
                addTargetToExternalLinks: true,
                defaultProtocol: 'https://'
            },
            list: {
                properties: {
                    styles: true,
                    startIndex: true,
                    reversed: true
                }
            },
            placeholder: 'Type or paste your content here!',
            table: {
                contentToolbar: [
                    'tableColumn', 'tableRow', 'mergeTableCells',
                    'tableProperties', 'tableCellProperties'
                ]
            }
        };

        DecoupledEditor
            .create(document.querySelector('#editor'), editorConfig)
            .then(editor => {
                // Add toolbar
                const toolbarContainer = document.querySelector('#editor-toolbar');
                toolbarContainer.appendChild(editor.ui.view.toolbar.element);

                // Add word count
                const wordCount = editor.plugins.get('WordCount');
                const wordCountContainer = document.querySelector('#editor-word-count');
                wordCountContainer.appendChild(wordCount.wordCountContainer);

                console.log('✅ CKEditor 5 GPL version loaded successfully!');
                console.log('✅ No license key required - 100% free forever!');
                
                window.editor = editor;
            })
            .catch(error => {
                console.warn(error.message);
            });

        // ==================== GET DATA FUNCTIONS ====================
        
        // 1. Get HTML data from editor
        function getEditorData() {
            const data = window.editor.getData();
            document.getElementById('output').value = data;
            showStatus('✅ HTML data retrieved successfully!', 'success');
            console.log('Editor HTML:', data);
            return data;
        }

        // 2. Get plain text (without HTML tags)
        function getEditorText() {
            const data = window.editor.getData();
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = data;
            const text = tempDiv.textContent || tempDiv.innerText || '';
            document.getElementById('output').value = text;
            showStatus('✅ Plain text retrieved successfully!', 'success');
            console.log('Plain text:', text);
            return text;
        }

        // 3. Copy data to clipboard
        function copyData() {
            const data = window.editor.getData();
            navigator.clipboard.writeText(data).then(() => {
                showStatus('✅ Content copied to clipboard!', 'success');
            }).catch(err => {
                showStatus('❌ Failed to copy: ' + err.message, 'error');
            });
        }

        // ==================== SET DATA FUNCTIONS ====================
        
        // 4. Set new content (replace existing)
        function setEditorData() {
            const input = document.getElementById('input').value;
            if (!input.trim()) {
                showStatus('⚠️ Please enter some content first!', 'warning');
                return;
            }
            window.editor.setData(input);
            showStatus('✅ Content set successfully!', 'success');
        }

        // 5. Append content to existing
        function appendData() {
            const input = document.getElementById('input').value;
            if (!input.trim()) {
                showStatus('⚠️ Please enter some content first!', 'warning');
                return;
            }
            const currentData = window.editor.getData();
            window.editor.setData(currentData + input);
            showStatus('✅ Content appended successfully!', 'success');
        }

        // 6. Clear editor
        function clearEditor() {
            if (confirm('Are you sure you want to clear all content?')) {
                window.editor.setData('');
                showStatus('✅ Editor cleared!', 'success');
            }
        }

        // ==================== SAMPLE DATA ====================
        
        function loadSample1() {
            const sample = `
                <h2>Sample Article 🎨</h2>
                <p>This is a <strong>sample article</strong> with <em>rich formatting</em>!</p>
                <ul>
                    <li>List item 1</li>
                    <li>List item 2</li>
                    <li>List item 3</li>
                </ul>
                <p>You can <u>underline</u>, <s>strikethrough</s>, and add <mark>highlights</mark>!</p>
            `;
            window.editor.setData(sample);
            showStatus('✅ Sample 1 loaded!', 'success');
        }

        function loadSample2() {
            const sample = `
                <h2>Code Example 💻</h2>
                <p>Here's a simple JavaScript function:</p>
                <pre><code>function greet(name) {
    return 'Hello, ' + name + '!';
}
console.log(greet('World'));</code></pre>
                <blockquote>
                    <p>"Programming is not about typing, it's about thinking." - Rich Hickey</p>
                </blockquote>
            `;
            window.editor.setData(sample);
            showStatus('✅ Sample 2 loaded!', 'success');
        }

        // ==================== LOCAL STORAGE ====================
        
        function saveToLocalStorage() {
            const data = window.editor.getData();
            localStorage.setItem('ckeditor_content', data);
            showStatus('✅ Content saved to browser storage!', 'success');
        }

        function loadFromLocalStorage() {
            const data = localStorage.getItem('ckeditor_content');
            if (data) {
                window.editor.setData(data);
                showStatus('✅ Content loaded from storage!', 'success');
            } else {
                showStatus('⚠️ No saved content found!', 'warning');
            }
        }

        // ==================== STATUS MESSAGE ====================
        
        function showStatus(message, type) {
            const statusDiv = document.getElementById('statusMsg');
            const colors = {
                success: '#10b981',
                error: '#ef4444',
                warning: '#f59e0b'
            };
            statusDiv.style.display = 'block';
            statusDiv.style.background = colors[type] || colors.success;
            statusDiv.style.color = 'white';
            statusDiv.textContent = message;
            setTimeout(() => {
                statusDiv.style.display = 'none';
            }, 3000);
        }

        // ==================== ADVANCED USAGE EXAMPLES ====================
        
        // // Auto-save every 30 seconds
        // setInterval(() => {
        //     const data = window.editor.getData();
        //     localStorage.setItem('ckeditor_autosave', data);
        //     console.log('✅ Auto-saved at:', new Date().toLocaleTimeString());
        // }, 30000);
}
editorInit();