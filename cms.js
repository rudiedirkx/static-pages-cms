"use strict";

class CmsUI {
	constructor() {
		this.$collectionButtons = elCreateButtons;
		this.$selectPageForm = elPageForm;
		this.$contentForm = elContentForm;
	}

	loadCollections(collections) {
		for (let cname in collections) {
			const btn = document.createElement('button');
			btn.textContent = collections[cname].label;
			btn.dataset.collection = cname;
			this.$collectionButtons.append(btn);
			this.$collectionButtons.append(' ');
		}
	}

	loadPages(pages) {
		const select = this.$selectPageForm.querySelector('select');
		select.innerHTML = pages.map(file => `<option value="${file.url}">${file.path}</option>`).join('');
	}

	loadContentForm(collection) {
		this.$contentForm.innerHTML = '';
		this.$contentForm.append(createFieldset(collection.fields, collection.label));
	}

	markOpenCollection(collection) {
		document.querySelectorAll('button[data-collection]').forEach(el => el.classList.remove('active'));
		document.querySelector(`button[data-collection="${collection}"]`).classList.add('active');
	}
}

class CmsContext {
	constructor(ui, provider) {
		this.ui = ui;
		this.provider = provider;

		this.collections = {};
		this.pages = {};

		this.collection = null;
	}

	findCollectionFromPath(path) {
		for ( let cname in this.collections ) {
			const collection = this.collections[cname];
			if (collection.file && collection.file == path) {
				return cname;
			}
			if (collection.folder && path.indexOf(collection.folder + '/') == 0) {
				return cname;
			}
		}
	}

	async loadCollections(config) {
		this.collections = await this.provider.findCollections(config);
		this.ui.loadCollections(this.collections);
		return this.collections;
	}

	async loadPages(tree) {
		this.pages = await this.provider.findPages(tree); /*.reduce((list, file), => {
			list[file.url] = file.path;
		});*/
		this.ui.loadPages(this.pages);
		return this.pages;
	}

	loadContentForm(collection) {
		this.collection = collection;
		this.ui.loadContentForm(this.collections[collection]);
		this.ui.markOpenCollection(collection);
	}
}

class CmsCollection {
	constructor(label, fields, options) {
		this.label = label;
		this.fields = {};
		this.folder = this.file = null;

		if (options) {
			if (options.folder) {
				this.folder = options.folder;
			}
			else if (options.file) {
				this.file = options.file;
			}
		}

		fields && this.setFields(fields);
	}

	setFields(fields) {
		this.fields = fields;
		this.ensureBody();
	}

	ensureBody() {
		if (!this.fields.body) {
			this.fields.body = new CmsField('hidden', '~body~');
		}
	}
}

class CmsField {
	constructor(widget, label, options) {
		this.widget = widget;
		this.label = label;

		options && this.setOptions(options);
		if (this.required == null) this.required = true;
	}

	setOptions(options) {
		for (let opt in options) {
			if (this[opt] === undefined) {
				this.setOption(opt, options[opt]);
			}
		}
	}

	setOption(name, value) {
		this[name] = value;
	}
}

class CmsWidget {
	create(props) {
	}

	created(fs) {
	}

	getValue(el, props) {
	}

	setValue(el, props, val) {
	}
}

class CmsWidgetInput extends CmsWidget {
	createInput(type) {
		const el = document.createElement('input');
		el.type = type || 'text';
		DEV && el.type != 'file' && (el.value = randomChar());
		return el;
	}

	create(props) {
		return this.createInput();
	}

	getValue(el, props) {
		return el.querySelector('input').value;
	}

	setValue(el, props, val) {
		return el.querySelector('input').value = val == null ? '' : val;
	}
}

class CmsWidgetString extends CmsWidgetInput {
	create(props) {
		return this.createInput('text');
	}
}

class CmsWidgetDate extends CmsWidgetInput {
	create(props) {
		return this.createInput('date');
	}
}

class CmsWidgetDatetime extends CmsWidgetInput {
	create(props) {
		return this.createInput('datetime');
	}
}

class CmsWidgetNumber extends CmsWidgetInput {
	create(props) {
		return this.createInput('number');
	}
}

class CmsWidgetFile extends CmsWidgetInput {
	create(props) {
		return this.createInput('text');
	}
}

class CmsWidgetImage extends CmsWidgetFile {
}

class CmsWidgetSelect extends CmsWidget {
	create(props) {
		const sel = document.createElement('select');
		[{value: '', label: '--'}, ...(props.options || [])].forEach(opt => {
			const el = document.createElement('option');
			el.value = opt.value || opt.label;
			el.textContent = opt.label || opt.value;
			sel.append(el);
		});
		return sel;
	}

	getValue(el, props) {
		return el.querySelector('select').value;
	}

	setValue(el, props, val) {
		return el.querySelector('select').value = val == null ? '' : val;
	}
}

class CmsWidgetText extends CmsWidget {
	create(props) {
		const el = document.createElement('textarea');
		DEV && (el.value = randomChar());
		return el;
	}

	getValue(el, props) {
		return el.querySelector('textarea').value;
	}

	setValue(el, props, val) {
		return el.querySelector('textarea').value = val == null ? '' : val;
	}
}

class CmsWidgetHidden extends CmsWidgetText {
	created(fs) {
		fs.hidden = true;
	}
}

class CmsWidgetMarkdown extends CmsWidgetText {
}

class CmsWidgetList extends CmsWidget {
	create(props) {
		return createFieldset(props.fields, 'Item 1');
	}

	getValue(el, props) {
		const items = Array.from(el.querySelectorAll(':scope > fieldset'));
		return items.map(fs => getFieldsetValues(fs));
	}

	setValue(el, props, value) {
		if (!value || !value.length) return;

		el.querySelectorAll(':scope > fieldset').forEach(fs => fs.remove());

		const L = value.length || 1;
		for ( let n = 0; n < L; n++ ) {
			const fs = createFieldset(props.fields, `Item ${n+1}`);
			el.append(fs);
			setFieldsetValues(fs, value[n]);
		}
	}
}

class CmsWidgetObject extends CmsWidget {
	create(props) {
		return createFieldset(props.fields);
	}

	getValue(el, props) {
		return getFieldsetValues(el.querySelector('fieldset'));
	}

	setValue(el, props, value) {
		setFieldsetValues(el.querySelector('fieldset'), value || {});
	}
}

const WIDGETS = {
	"hidden": new CmsWidgetHidden(),
	"string": new CmsWidgetString(),
	"date": new CmsWidgetDate(),
	"datetime": new CmsWidgetDatetime(),
	"number": new CmsWidgetNumber(),
	"file": new CmsWidgetFile(),
	"image": new CmsWidgetImage(),
	"select": new CmsWidgetSelect(),
	"text": new CmsWidgetText(),
	"markdown": new CmsWidgetMarkdown(),
	"list": new CmsWidgetList(),
	"object": new CmsWidgetObject(),
};
