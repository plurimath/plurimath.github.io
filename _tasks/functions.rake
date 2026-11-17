# frozen_string_literal: true

# Generates the pages under functions/ from _data/functions.yml.
#
# Each entry in the data file names a function and gives one example in one
# source format. Every other example on the page is produced by parsing that
# source with the plurimath gem and converting it, so the pages always show
# what the gem actually does.
#
#   BUNDLE_GEMFILE=_tasks/Gemfile bundle exec rake functions:generate
#   BUNDLE_GEMFILE=_tasks/Gemfile bundle exec rake functions:check
#
# generate rewrites functions/*.adoc; check exits 1 if any page is out of date.
#
# OMML examples leave out the namespace declarations on m:oMathPara, which
# are the same for every output.

require "plurimath"
require "yaml"

module FunctionPages
  DATA_FILE = "_data/functions.yml"
  OUTPUT_DIR = "functions"

  FORMATS = {
    "asciimath" => { heading: "AsciiMath", lang: "asciimath", writer: :to_asciimath },
    "latex" => { heading: "LaTeX", lang: "latex", writer: :to_latex },
    "mathml" => { heading: "MathML", lang: "xml", writer: :to_mathml },
    "omml" => { heading: "OMML", lang: "xml", writer: :to_omml },
    "unicodemath" => { heading: "UnicodeMath", lang: "unicodemath", writer: :to_unicodemath },
  }.freeze

  PARSE_AS = { "unicodemath" => :unicode }.freeze

  # OMML sources are written without namespace declarations, like the
  # generated OMML examples; these are added back before parsing.
  OMML_NAMESPACES = 'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' \
                    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

  module_function

  def functions
    YAML.safe_load_file(DATA_FILE)
  end

  def pages
    errors = []
    result = functions.to_h do |function|
      ["#{OUTPUT_DIR}/#{function.fetch('name')}.adoc", render_page(function)]
    rescue StandardError => e
      errors << e.message
      [nil, nil]
    end
    raise "Cannot generate function pages:\n#{errors.join("\n")}" if errors.any?

    result
  end

  def render_page(function)
    front_matter = {
      "title" => function.fetch("title"),
      "layout" => "function",
      "function-name" => function.fetch("name"),
      "function-type" => function.fetch("type"),
    }
    parts = [front_matter.to_yaml.sub(/\A---\n/, "---\n") + "---"]
    function.fetch("entries").each { |entry| parts << render_entry(function, entry) }
    "#{parts.join("\n\n")}\n"
  end

  def render_entry(function, entry)
    source = entry.fetch("source")
    source_format = source.fetch("format")
    input = source.fetch("input")
    formula = parse(input, source_format)
    parts = ["[[#{entry.fetch('anchor')}]]\n== #{entry.fetch('heading')}"]
    entry.fetch("formats").each do |format|
      spec = FORMATS.fetch(format) { raise "#{function['name']}: unknown format #{format}" }
      text = format == source_format ? input : convert(formula, format, spec)
      parts << "=== #{spec[:heading]}\n\n[source,#{spec[:lang]}]\n----\n#{text}\n----"
    end
    parts.concat(entry.fetch("notes", []))
    parts.join("\n\n")
  rescue StandardError => e
    raise "#{function['name']} (#{entry['anchor']}): #{e.class}: #{e.message}"
  end

  def parse(input, format)
    text = input
    text = text.sub(/\A<m:oMathPara>/, "<m:oMathPara #{OMML_NAMESPACES}>") if format == "omml"
    Plurimath::Math.parse(text, PARSE_AS.fetch(format, format.to_sym))
  end

  def convert(formula, format, spec)
    text = formula.public_send(spec[:writer]).to_s.strip
    text = text.sub(/\A<m:oMathPara\b[^>]*>/, "<m:oMathPara>") if format == "omml"
    text
  end

  def stale_pages
    expected = pages
    changed = expected.reject { |path, text| File.exist?(path) && File.read(path) == text }.keys
    orphans = Dir["#{OUTPUT_DIR}/*.adoc"] - expected.keys
    [changed, orphans]
  end
end

namespace :functions do
  desc "Generate functions/*.adoc from #{FunctionPages::DATA_FILE} using the plurimath gem"
  task :generate do
    FunctionPages.pages.each { |path, text| File.write(path, text) }
    _, orphans = FunctionPages.stale_pages
    orphans.each { |path| warn "#{path} has no entry in #{FunctionPages::DATA_FILE}" }
    abort if orphans.any?
  end

  desc "Fail if functions/*.adoc differ from what functions:generate would write"
  task :check do
    changed, orphans = FunctionPages.stale_pages
    changed.each { |path| warn "#{path} is out of date; run `BUNDLE_GEMFILE=_tasks/Gemfile bundle exec rake functions:generate`" }
    orphans.each { |path| warn "#{path} has no entry in #{FunctionPages::DATA_FILE}" }
    abort if changed.any? || orphans.any?
    puts "functions/*.adoc are up to date (plurimath #{Gem.loaded_specs['plurimath']&.version})"
  end
end
